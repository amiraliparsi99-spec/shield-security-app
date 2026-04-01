import { redirect } from "next/navigation";
import { FloatingOrb } from "@/components/ui/motion";
import GateForm from "./GateForm";

export const metadata = {
  title: "Coming Soon | Shield HQ",
  robots: { index: false, follow: false },
};

export default function GatePage() {
  if (!process.env.SITE_PASSWORD?.trim()) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="fixed inset-0 -z-10">
        <div className="gradient-bg absolute inset-0" />
        <div className="mesh-gradient absolute inset-0" />
        <FloatingOrb size={350} color="teal" className="absolute -left-20 top-20" delay={0} />
        <FloatingOrb size={250} color="cyan" className="absolute right-10 bottom-20" delay={2} />
        <div className="grid-pattern absolute inset-0 opacity-30" />
      </div>
      <GateForm />
    </div>
  );
}
