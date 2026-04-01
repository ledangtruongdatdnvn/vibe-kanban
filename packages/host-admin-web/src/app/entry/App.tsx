import { ThemeProvider } from "@host-admin/app/providers/ThemeProvider";
import { HostAdminPage } from "@host-admin/features/host-admin/ui/HostAdminPage";

function App() {
  return (
    <ThemeProvider>
      <div className="new-design min-h-screen bg-primary font-ibm-plex-sans text-normal">
        <HostAdminPage />
      </div>
    </ThemeProvider>
  );
}

export default App;
