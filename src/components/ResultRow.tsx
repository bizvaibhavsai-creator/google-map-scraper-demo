import type { MapResult, ContactsState } from '@/types';
import { LoadingSpinner } from './LoadingSpinner';
import { ContactsCell } from './ContactsCell';

interface Props {
  result: MapResult;
  contactsState: ContactsState;
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

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      {/* Name */}
      <td className="px-4 py-3 text-sm font-medium text-gray-900 align-top">
        {result.name}
      </td>

      {/* Category */}
      <td className="px-4 py-3 text-sm text-gray-600 align-top">
        {category}
      </td>

      {/* Status */}
      <td className="px-4 py-3 align-top">
        <span className={`inline-block text-xs rounded px-2 py-0.5 ${
          result.is_permanently_closed
            ? 'bg-red-100 text-red-700'
            : result.is_temporarily_closed
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-green-100 text-green-700'
        }`}>
          {closedStatus}
        </span>
      </td>

      {/* Keyword */}
      <td className="px-4 py-3 align-top">
        <span className="inline-block text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">
          {result._keyword}
        </span>
      </td>

      {/* Location */}
      <td className="px-4 py-3 align-top">
        <span className="inline-block text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
          {result._location}
        </span>
      </td>

      {/* Address */}
      <td className="px-4 py-3 text-sm text-gray-600 align-top">{result.full_address || '—'}</td>

      {/* Phone */}
      <td className="px-4 py-3 text-sm text-gray-600 align-top whitespace-nowrap">
        {result.phone_number ? (
          <a href={`tel:${result.phone_number}`} className="text-blue-600 hover:underline">
            {result.phone_number}
          </a>
        ) : (
          '—'
        )}
      </td>

      {/* Rating */}
      <td className="px-4 py-3 text-sm text-gray-600 align-top whitespace-nowrap">
        {result.rating != null ? (
          <span className="flex items-center gap-1">
            <span className="text-yellow-500">★</span> {rating}
          </span>
        ) : (
          '—'
        )}
      </td>

      {/* Reviews */}
      <td className="px-4 py-3 text-sm text-gray-600 align-top whitespace-nowrap">{reviews}</td>

      {/* Website */}
      <td className="px-4 py-3 text-sm align-top">
        {result.website ? (
          <a
            href={result.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-xs break-all"
          >
            {result.website.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span className="text-gray-400 text-xs italic">No website</span>
        )}
      </td>

      {/* Email */}
      <td className="px-4 py-3 align-top">
        {!result.website ? (
          <span className="text-gray-400 text-xs">—</span>
        ) : contactsState.status === 'idle' || contactsState.status === 'loading' ? (
          <LoadingSpinner size="sm" />
        ) : contactsState.status === 'success' ? (
          <ContactsCell data={contactsState.data} />
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}
