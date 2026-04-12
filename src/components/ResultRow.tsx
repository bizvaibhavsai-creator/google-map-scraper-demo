import type { MapResult, ContactsState } from '@/types';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  result: MapResult;
  contactsState?: ContactsState;
}

export function ResultRow({ result, contactsState }: Props) {
  const rating = result.rating != null ? result.rating.toFixed(1) : '—';
  const reviews = result.review_count != null ? result.review_count.toLocaleString() : '—';
  const category = Array.isArray(result.types) ? result.types.join(', ') : (result.types || '—');
  const closedStatus = result.is_permanently_closed
    ? 'Permanently Closed'
    : result.is_temporarily_closed
      ? 'Temporarily Closed'
      : 'Open';

  let emailDisplay: React.ReactNode = '—';
  if (contactsState) {
    if (!result.website) {
      emailDisplay = <span className="text-xs text-slate-400">No website</span>;
    } else if (contactsState.status === 'idle' || contactsState.status === 'loading') {
      emailDisplay = <LoadingSpinner size="sm" />;
    } else if (contactsState.status === 'success') {
      const emails = contactsState.data.emails;
      emailDisplay = emails.length > 0
        ? <span className="break-all text-sm text-slate-700">{emails.join(', ')}</span>
        : <span className="text-xs text-slate-400">None found</span>;
    } else if (contactsState.status === 'error') {
      emailDisplay = <span className="text-xs text-red-500">Error</span>;
    }
  }

  return (
    <tr className="border-b border-slate-200/60 transition-colors hover:bg-white/70">
      <td className="px-4 py-4 align-top text-sm font-medium text-slate-900">{result.name}</td>
      <td className="px-4 py-4 align-top text-sm text-slate-600">{category}</td>
      <td className="px-4 py-4 align-top">
        <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
          result.is_permanently_closed
            ? 'bg-red-100 text-red-700'
            : result.is_temporarily_closed
              ? 'bg-amber-100 text-amber-700'
              : 'bg-teal-100 text-teal-700'
        }`}>
          {closedStatus}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">{result._keyword}</span>
      </td>
      <td className="px-4 py-4 align-top">
        <span className="inline-block rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700">{result._location}</span>
      </td>
      <td className="px-4 py-4 align-top text-sm text-slate-600">{result.full_address || '—'}</td>
      <td className="px-4 py-4 align-top whitespace-nowrap text-sm text-slate-600">
        {result.phone_number ? (
          <a href={`tel:${result.phone_number}`} className="text-slate-900 underline-offset-2 hover:underline">{result.phone_number}</a>
        ) : '—'}
      </td>
      <td className="px-4 py-4 align-top whitespace-nowrap text-sm text-slate-600">
        {result.rating != null ? (
          <span className="flex items-center gap-1"><span className="text-amber-500">★</span> {rating}</span>
        ) : '—'}
      </td>
      <td className="px-4 py-4 align-top whitespace-nowrap text-sm text-slate-600">{reviews}</td>
      <td className="px-4 py-4 align-top text-sm">
        {result.website ? (
          <a href={result.website} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-slate-900 underline-offset-2 hover:underline">
            {result.website.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span className="text-xs italic text-slate-400">No website</span>
        )}
      </td>
      {contactsState && <td className="px-4 py-4 align-top">{emailDisplay}</td>}
    </tr>
  );
}
