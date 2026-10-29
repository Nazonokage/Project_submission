export function isSlotParticipant(slot: { excludedStudentIds?: string[] | null }, studentId: string) {
  return !slot.excludedStudentIds?.includes(studentId);
}
