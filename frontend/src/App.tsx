import { Toaster } from "@/components/ui/toaster";
import { MessageHost } from "@/components/ui/message";
import AppRoutes from "@/routes";

const App = () => {
  return (
    <>
      <AppRoutes />
      <Toaster />
      <MessageHost />
    </>
  );
};

export default App;
