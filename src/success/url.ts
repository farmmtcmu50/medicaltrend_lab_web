// Where the booking forms send the customer once a booking is saved (see SuccessApp.tsx).
export const successUrl = (b: { ref: string; mode: 'lab' | 'home'; lang: string; total: number; src: 'main' | 'std' }) =>
  '/booking-success?' + new URLSearchParams({ booking: b.ref, mode: b.mode, lang: b.lang, value: String(Math.round(b.total || 0)), src: b.src });
