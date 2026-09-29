-- Where the customer came from before booking (?ref / ?utm_source, referring site, or 'direct').
ALTER TABLE bookings ADD COLUMN referrer TEXT;
