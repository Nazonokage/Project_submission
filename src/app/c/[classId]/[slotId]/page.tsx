import { SlotDashboard } from './slot-dashboard';

export default async function SlotPage({ params: promisedParams }: { params: Promise<{ classId: string; slotId: string }> }) {
  const params = await promisedParams;
  return <SlotDashboard classId={params.classId} slotId={params.slotId} />;
}
