from .client import ChatClient

def run_chat(client: ChatClient):
    print("Chatbot ready! Type 'quit' to exit, 'clear' to reset.")
    while True:
        try:
            user_input = input("You: ").strip()
            if not user_input:
                continue
            if user_input.lower() == 'quit':
                break
            if user_input.lower() == 'clear':
                client.clear_history()
                print("Chat history cleared.")
                continue
            
            response = client.chat(user_input)
            print(f"Bot: {response}\n")
        except KeyboardInterrupt:
            print("\n Fuck you Goodbye!")
            break
        except EOFError:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")
