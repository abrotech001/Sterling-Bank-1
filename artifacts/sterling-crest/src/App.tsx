import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isLoggedIn } from "@/lib/auth";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import TransactionsPage from "@/pages/transactions";
import TransferPage from "@/pages/transfer";
import DepositPage from "@/pages/deposit";
import WithdrawPage from "@/pages/withdraw";
import GiftCardsPage from "@/pages/giftcards";
import CardsPage from "@/pages/cards";
import KYCPage from "@/pages/kyc";
import SupportPage from "@/pages/support";
import NotificationsPage from "@/pages/notifications";
import SettingsPage from "@/pages/settings";
import LoansPage from "@/pages/loans";
import WealthPage from "@/pages/wealth";
import RewardsPage from "@/pages/rewards";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (!isLoggedIn()) return <Redirect to="/login" />;
  return <Component />;
}

function PublicOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  if (isLoggedIn()) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => isLoggedIn() ? <Redirect to="/dashboard" /> : <LandingPage />} />
      <Route path="/login" component={() => <PublicOnlyRoute component={LoginPage} />} />
      <Route path="/register" component={() => <PublicOnlyRoute component={RegisterPage} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/transactions" component={() => <ProtectedRoute component={TransactionsPage} />} />
      <Route path="/transfer" component={() => <ProtectedRoute component={TransferPage} />} />
      <Route path="/deposit" component={() => <ProtectedRoute component={DepositPage} />} />
      <Route path="/withdraw" component={() => <ProtectedRoute component={WithdrawPage} />} />
      <Route path="/giftcards" component={() => <ProtectedRoute component={GiftCardsPage} />} />
      <Route path="/cards" component={() => <ProtectedRoute component={CardsPage} />} />
      <Route path="/kyc" component={() => <ProtectedRoute component={KYCPage} />} />
      <Route path="/support" component={() => <ProtectedRoute component={SupportPage} />} />
      <Route path="/notifications" component={() => <ProtectedRoute component={NotificationsPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/loans" component={() => <ProtectedRoute component={LoansPage} />} />
      <Route path="/wealth" component={() => <ProtectedRoute component={WealthPage} />} />
      <Route path="/rewards" component={() => <ProtectedRoute component={RewardsPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
