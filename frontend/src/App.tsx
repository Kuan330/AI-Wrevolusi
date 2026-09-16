import AppRoutes from "@/routes";
import { Toaster } from "sonner";

const App = () => {
  return (
    <>
      <AppRoutes />
      <Toaster position="top-right" richColors />
    </>
  );
};

export default App;
