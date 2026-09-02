import { SlotDashboard } from './slot-dashboard';

export default function SlotPage({ params }: { params: { classId: string; slotId: string } }) {
  return <SlotDashboard classId={params.classId} slotId={params.slotId} />;
}
