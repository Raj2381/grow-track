import { useRef, useState } from 'react'
import { Info, Upload, X } from 'lucide-react'
import { Button } from '@student/components/ui/button'
import { Input, Label, Modal, Select, Textarea, useToast } from '@student/components/ui/misc'
import { addActivity } from '@student/services/api'
import { useStudent } from '@student/hooks/useStudent'
import { TODAY } from '@student/data/students'
import { ENGAGEMENT_POINTS } from '@student/lib/scoring'
import { CATEGORY_OPTIONS, PARTICIPATION_OPTIONS, TYPE_LABEL } from '@student/lib/engagement'

const MAX_BYTES = 10 * 1024 * 1024
const OK_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const empty = { name: '', category: '', customCategory: '', organization: '', date: '', participation: 'Participant', customParticipation: '', achievement: '', description: '', link: '' }
const err = (m?: string) => (m ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{m}</p> : null)

export function AddActivityForm({ open, onClose, semester }: { open: boolean; onClose: () => void; semester: number }) {
  const { studentId } = useStudent()
  const toast = useToast()
  const [f, setF] = useState(empty)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const opt = CATEGORY_OPTIONS.find((o) => o.value === f.category)
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF((p) => ({ ...p, [k]: e.target.value }))
    setErrors((p) => ({ ...p, [k]: '' }))
  }
  const close = () => { if (!saving) onClose() }
  const fileError = (x: File | null) => (x && (!OK_TYPES.includes(x.type) || x.size > MAX_BYTES) ? 'Choose a PDF, PNG or JPG file under 10 MB.' : '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const n: Record<string, string> = {}
    if (!f.name.trim()) n.name = 'Enter the activity name.'
    if (!f.category) n.category = 'Choose a category.'
    if (f.category === 'Other' && !f.customCategory.trim()) n.customCategory = 'Specify the category.'
    if (!f.date) n.date = 'Choose the activity date.'
    else if (f.date > TODAY) n.date = 'The date cannot be in the future.'
    if (f.participation === 'Other' && !f.customParticipation.trim()) n.customParticipation = 'Specify your participation type.'
    if (f.link.trim()) {
      try { if (!['http:', 'https:'].includes(new URL(f.link.trim()).protocol)) throw new Error() } catch { n.link = 'Enter a valid http or https link.' }
    }
    const fe = fileError(file)
    if (fe) n.evidence = fe
    if (!file && !f.link.trim()) n.evidence = 'Add a certificate/photo or a reference link so faculty can verify this activity.'
    setErrors(n)
    if (Object.keys(n).length) return

    setSaving(true)
    try {
      const kind = f.category === 'Other' ? f.customCategory.trim() : opt!.category
      await addActivity(studentId, {
        type: opt!.type,
        kind,
        title: f.name.trim(),
        organizer: f.organization.trim(),
        date: f.date,
        role: f.participation === 'Other' ? f.customParticipation.trim() : f.participation,
        category: kind,
        achievement: f.achievement.trim() || undefined,
        description: f.description.trim() || undefined,
        link: f.link.trim() || undefined,
        proof: file?.name ?? '',
        semester,
      })
      toast.success('Activity submitted. Status: Pending verification')
      setF(empty); setFile(null); setErrors({})
      onClose()
    } catch {
      toast.error('Could not save this activity. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Add activity" wide>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="act-name">Activity name *</Label>
          <Input id="act-name" autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Smart India Hackathon" aria-invalid={!!errors.name} />{err(errors.name)}
        </div>
        <div>
          <Label htmlFor="act-cat">Category *</Label>
          <Select id="act-cat" value={f.category} onChange={set('category')} aria-invalid={!!errors.category}>
            <option value="">Select a category</option>
            {CATEGORY_OPTIONS.map((o) => <option key={o.value}>{o.value}</option>)}
          </Select>{err(errors.category)}
        </div>
        {f.category === 'Other' && (
          <div className="sm:col-span-2"><Label htmlFor="act-ccat">Specify category *</Label><Input id="act-ccat" value={f.customCategory} onChange={set('customCategory')} aria-invalid={!!errors.customCategory} />{err(errors.customCategory)}</div>
        )}
        {opt && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs sm:col-span-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>Scored as <b>{TYPE_LABEL[opt.type]}</b>: <b>+{ENGAGEMENT_POINTS[opt.type]} points</b> once a faculty coordinator approves it.</span>
          </div>
        )}
        <div><Label htmlFor="act-org">Organization</Label><Input id="act-org" value={f.organization} onChange={set('organization')} placeholder="Club, company or organizer" /></div>
        <div>
          <Label htmlFor="act-date">Activity date *</Label>
          <Input id="act-date" type="date" max={TODAY} value={f.date} onChange={set('date')} aria-invalid={!!errors.date} />{err(errors.date)}
        </div>
        <div>
          <Label htmlFor="act-part">Participation type</Label>
          <Select id="act-part" value={f.participation} onChange={set('participation')}>{PARTICIPATION_OPTIONS.map((o) => <option key={o}>{o}</option>)}</Select>
        </div>
        <div><Label htmlFor="act-ach">Achievement or outcome</Label><Input id="act-ach" value={f.achievement} onChange={set('achievement')} placeholder="e.g. 2nd place, Elite certificate" /></div>
        {f.participation === 'Other' && (
          <div className="sm:col-span-2"><Label htmlFor="act-cpart">Specify participation type *</Label><Input id="act-cpart" value={f.customParticipation} onChange={set('customParticipation')} aria-invalid={!!errors.customParticipation} />{err(errors.customParticipation)}</div>
        )}
        <div className="sm:col-span-2"><Label htmlFor="act-desc">Description</Label><Textarea id="act-desc" rows={3} value={f.description} onChange={set('description')} placeholder="What you did and what you learned" /></div>
        <div className="sm:col-span-2">
          <Label htmlFor="act-proof">Certificate or evidence (PDF, PNG, JPG · max 10 MB)</Label>
          <label htmlFor="act-proof" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm hover:bg-muted">
            <Upload className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate">{file ? file.name : 'Choose a file…'}</span>
            {file && <button type="button" aria-label="Remove file" onClick={(e) => { e.preventDefault(); setFile(null); if (fileRef.current) fileRef.current.value = '' }} className="rounded p-0.5 hover:bg-card"><X className="h-4 w-4" /></button>}
          </label>
          <input ref={fileRef} id="act-proof" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="sr-only"
            onChange={(e) => { const x = e.target.files?.[0] ?? null; setFile(x); setErrors((p) => ({ ...p, evidence: fileError(x) })) }} />
          {err(errors.evidence)}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="act-link">Reference link</Label>
          <Input id="act-link" type="url" value={f.link} onChange={set('link')} placeholder="https://… certificate, project or event page" aria-invalid={!!errors.link} />{err(errors.link)}
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4 sm:col-span-2">
          <Button type="button" variant="outline" disabled={saving} onClick={close}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit for verification'}</Button>
        </div>
      </form>
    </Modal>
  )
}
