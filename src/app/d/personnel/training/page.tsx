import { TrainingModules } from "@/components/training/TrainingModules";

export const metadata = {
  title: "Training Academy | Shield",
  description: "Micro-courses to boost your skills and earnings",
};

export default function TrainingPage() {
  return (
    <div className="min-h-screen p-6">
      <TrainingModules />
    </div>
  );
}
