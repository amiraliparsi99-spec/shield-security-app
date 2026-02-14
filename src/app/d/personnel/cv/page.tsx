import { DigitalCV, DEMO_CV_DATA } from "@/components/personnel/DigitalCV";

export const metadata = {
  title: "My Digital CV | Shield",
  description: "Your verified work history and training passport",
};

export default function DigitalCVPage() {
  // In production, fetch from Supabase using session user ID
  const personnelId = "demo-personnel-1";

  return (
    <div className="min-h-screen p-6">
      <DigitalCV personnelId={personnelId} {...DEMO_CV_DATA} />
    </div>
  );
}
