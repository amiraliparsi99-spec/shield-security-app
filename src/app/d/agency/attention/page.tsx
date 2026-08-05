import { AttentionInbox } from "@/components/notifications/AttentionInbox";

export default function AgencyAttentionPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AttentionInbox basePath="/d/agency" />
    </div>
  );
}
