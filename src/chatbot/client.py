from openai import OpenAI

class ChatClient:
    def __init__(self, api_key: str, model: str = "openai/gpt-3.5-turbo", base_url: str = "https://openrouter.ai/api/v1"):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.messages = [{"role": "system", "content": "You are a helpful assistant. Keep responses concise."}]
    
    def chat(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=self.messages
            )
            assistant_message = response.choices[0].message.content
            self.messages.append({"role": "assistant", "content": assistant_message})
            return assistant_message
        except Exception as e:
            raise RuntimeError(f"API call failed: {e}")
    
    def clear_history(self):
        self.messages = [{"role": "system", "content": "You are a helpful assistant. Keep responses concise."}]