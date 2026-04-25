export type Wallet = {
  id: number;
  userId: number;
  balance: string | number;
  pendingBalance: string | number;
  currency: string;
  updatedAt?: string;
};

export type User = {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  accountNumber: string;
  kycLevel: number;
  hasPin?: boolean;
  profileImage?: string | null;
  status: string;
  createdAt: string;
  wallet?: Wallet | null;
};

export function getUser(): User | null {
  const raw = localStorage.getItem("scb_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: User) {
  localStorage.setItem("scb_token", token);
  localStorage.setItem("scb_user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("scb_token");
  localStorage.removeItem("scb_user");
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem("scb_token");
}
