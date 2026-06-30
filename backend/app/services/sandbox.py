import asyncio
import tempfile
import os
from pathlib import Path

SUPPORTED_LANGUAGES = {
    "python": {"ext": ".py", "cmd": ["python3", "-u"]},
    "javascript": {"ext": ".js", "cmd": ["node"]},
    "typescript": {"ext": ".ts", "cmd": ["npx", "ts-node", "--transpile-only"]},
    "bash": {"ext": ".sh", "cmd": ["bash"]},
    "shell": {"ext": ".sh", "cmd": ["bash"]},
}

TIMEOUT_SECONDS = 10
MAX_OUTPUT_CHARS = 5000


async def run_code(code: str, language: str) -> dict:
    lang = language.lower().strip()
    if lang not in SUPPORTED_LANGUAGES:
        return {
            "success": False,
            "output": "",
            "error": f"Unsupported language: {lang}. Supported: {', '.join(SUPPORTED_LANGUAGES.keys())}",
        }

    config = SUPPORTED_LANGUAGES[lang]
    ext = config["ext"]
    cmd = config["cmd"]

    with tempfile.NamedTemporaryFile(mode="w", suffix=ext, delete=False) as f:
        f.write(code)
        tmp_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return {
                "success": False,
                "output": "",
                "error": f"Execution timed out after {TIMEOUT_SECONDS}s",
            }

        stdout_str = stdout.decode(errors="replace")[:MAX_OUTPUT_CHARS]
        stderr_str = stderr.decode(errors="replace")[:MAX_OUTPUT_CHARS]

        if proc.returncode == 0:
            return {"success": True, "output": stdout_str, "error": ""}
        else:
            return {"success": False, "output": stdout_str, "error": stderr_str}

    except FileNotFoundError:
        return {
            "success": False,
            "output": "",
            "error": f"Runtime for {lang} not installed on server",
        }
    except Exception as e:
        return {"success": False, "output": "", "error": str(e)}
    finally:
        os.unlink(tmp_path)
