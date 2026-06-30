from .config import load_config
from .client import ChatClient
from .chat import run_chat

def main():
    config = load_config()
    if not config["api_key"]:
        print("Error: OPENAI_API_KEY not set. Copy .env.example to .env and add your key.")
        return
    
    client = ChatClient(api_key=config["api_key"], model=config["model"], base_url=config["base_url"])
    run_chat(client)

if __name__ == "__main__":
    main()