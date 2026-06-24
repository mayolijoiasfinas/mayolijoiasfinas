import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { StoreProvider } from "@/context/StoreContext";
import { AppShell } from "@/components/layout/AppShell";

import { Home } from "@/pages/Home";
import { Catalog } from "@/pages/Catalog";
import { Sales } from "@/pages/Sales";
import { Inventory } from "@/pages/Inventory";
import { Customers } from "@/pages/Customers";
import { CustomerProfile } from "@/pages/CustomerProfile";
import { Finance } from "@/pages/Finance";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/catalogo" component={Catalog} />
        <Route path="/vendas" component={Sales} />
        <Route path="/estoque" component={Inventory} />
        <Route path="/clientes" component={Customers} />
        <Route path="/clientes/:id" component={CustomerProfile} />
        <Route path="/financas" component={Finance} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
}

export default App;
