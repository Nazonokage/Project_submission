'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useBoardQuery } from '@/lib/board-query';
import { boardKeys } from '@/lib/query-keys';
import { FeedbackList, ProfessorFeedbackForm, type FeedbackItem } from './title-review';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function ProfileTitleFeedback({ titleId, titleText, onClose }: { titleId: string; titleText: string; onClose: () => void }) {
  const client = useQueryClient();
  const key = boardKeys.feedback('prof', titleId);
  const query = useBoardQuery<{ feedback: FeedbackItem[] }>(key, `/api/dashboard/feedback?titleId=${titleId}`);
  const refresh = () => { void client.invalidateQueries({ queryKey: key }); };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="rounded-3xl max-h-[85dvh] overflow-auto w-[calc(100%-2rem)]">
      <DialogHeader><DialogTitle>Project feedback</DialogTitle><DialogDescription>{titleText} — visible to all group members in their feedback notifications.</DialogDescription></DialogHeader>
      <ProfessorFeedbackForm titleId={titleId} onSaved={refresh} />
      <p className="text-xs text-muted">Approval feedback is a message. To approve the project title itself, use Edit title.</p>
      {query.isPending ? <p className="text-sm text-muted">Loading feedback…</p> : query.error ? <p role="alert" className="text-sm text-danger">Could not load feedback. Please reopen this panel to retry.</p> : <FeedbackList items={query.data?.feedback || []} canResolve onChanged={refresh} />}
    </DialogContent>
  </Dialog>;
}
