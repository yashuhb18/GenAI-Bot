interface GoogleAccounts {
  id: {
    initialize(config: {
      client_id: string;
      callback: (response: { credential: string }) => void;
    }): void;
    prompt(): void;
  };
}

interface Google {
  accounts: GoogleAccounts;
}

declare global {
  interface Window {
    google?: Google;
  }
}

export {};
