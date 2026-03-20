import type { ContactInfo } from '@/types';

export function ContactsCell({ data }: { data: ContactInfo }) {
  if (data.emails.length === 0) {
    return <span className="text-gray-400 text-xs italic">No emails found</span>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {data.emails.map((email) => (
        <a
          key={email}
          href={`mailto:${email}`}
          className="inline-block text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-100 break-all"
        >
          {email}
        </a>
      ))}
    </div>
  );
}
