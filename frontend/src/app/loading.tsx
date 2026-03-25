import LoadingState from '@/components/ui/LoadingState';

// Global loading component for page transitions
export default function Loading() {
  return <LoadingState message="Loading your content..." icon="bolt" />;
}
