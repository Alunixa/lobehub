# Current date and time

Use this skill whenever the user asks for the current date, day of the week,
time, or exact seconds, or when a decision needs an up-to-date clock reading.

1. Call `lobe-skills.getCurrentTime` now. No shell, sandbox, web search, or API key is needed.
2. Omit `timezone` to use the user's saved timezone. If the user requests a specific
   location, pass its IANA timezone (for example `Asia/Shanghai` or `America/New_York`).
3. Report the returned local date and `HH:mm:ss`, weekday, timezone and UTC offset.
   Explain that this is the time of the tool call, not a continuously ticking clock.
4. For another current-time question, call the tool again. Never estimate seconds
   from the minute-resolution request context or reuse an earlier tool result.
5. If the timezone is invalid, correct it and retry; if the tool fails, state the
   failure rather than inventing the time. Do not confuse the UTC `iso8601` field
   with the local `date` and `time` fields.
