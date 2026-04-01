import { RouterProvider } from "@tanstack/react-router";
import { ThemeProvider } from "@admin/app/providers/ThemeProvider";
import { router } from "@admin/app/router";

function App() {
  return (
    <ThemeProvider>
      <div className="new-design min-h-screen bg-primary font-ibm-plex-sans text-normal">
        <RouterProvider router={router} />
      </div>
    </ThemeProvider>
  );
}

export default App;
