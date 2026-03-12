export function getTimeInformation(date = new Date()): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const dayNum = date.toLocaleDateString('en-US', { day: '2-digit' });
  const year = date.toLocaleDateString('en-US', { year: 'numeric' });
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `Current Real-time Information:\nDay: ${day}\nDate: ${dayNum}\nMonth: ${month}\nYear: ${year}\nTime: ${hh} hours, ${mm} minutes, ${ss} seconds`;
}
