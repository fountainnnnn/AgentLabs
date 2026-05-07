
export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: "#FCFCF7" }}
    >
      {children}
    </div>
  );
}
