/**
 * Entities backing the Tasks & calendar page. Not secret, so git-tracked.
 *
 * Events from every calendar listed here are merged into one agenda.
 * Not included, though they exist on this instance: calendar.home (HA's own
 * Local Calendar, "Home 🏡") and calendar.inbox (Todoist as a calendar).
 */
/** Google "Birthdays" feed — every event on it gets a cake marker on the month grid. */
export const BIRTHDAY_CALENDAR_ENTITY_ID = 'calendar.birthdays';

/** Ville de Lévis curbside pickup schedule (recycling / compost / garbage, in French). */
export const COLLECTION_CALENDAR_ENTITY_ID = 'calendar.vendredi_est';

export const CALENDAR_ENTITY_IDS = [
  BIRTHDAY_CALENDAR_ENTITY_ID,
  'calendar.shamann4242_gmail_com',
  'calendar.holidays_in_canada',
  COLLECTION_CALENDAR_ENTITY_ID,
];

/** `todo.inbox` is the Todoist Inbox list; todo.home and todo.shopping_list also exist. */
export const TODO_ENTITY_ID = 'todo.inbox';
