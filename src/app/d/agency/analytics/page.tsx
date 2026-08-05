import { redirect } from "next/navigation";

/**
 * Not ready for beta — hidden from nav and redirected so testers cannot
 * reach a half-built screen by URL. The previous implementation is in git
 * history; restore it here when the feature is finished.
 */
export default function UnfinishedAgencyPage() {
  redirect("/d/agency");
}
