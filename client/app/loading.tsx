import PageLoader from "@/components/ui/PageLoader";

/** Route-level loading boundary: one spinner for the whole viewport. */
export default function Loading() {
  return <PageLoader label="Loading the portfolio" />;
}
