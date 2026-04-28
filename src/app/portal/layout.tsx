import PortalSidebar from "@/components/PortalSidebar";

export const metadata = {
  title: "Z-Health Portal",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-[#1c1c1e]">
      <PortalSidebar />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
