import { Toaster } from "@/components/ui/toaster";
import AppRoutes from "@/routes";

const App = () => {
  return (
    <>
      <AppRoutes />
      <Toaster />
    </>
  );
};

export default App;
