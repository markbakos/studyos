---
name: build-react-lists
description: Build reusable, efficient React list and table-like interfaces with compound components, shared state, debounced filtering, sorting, counts, Set-backed selection, and bulk actions. Use when implementing or refactoring list screens, row/header pairs, searchable or sortable collections, selectable rows, or large client-rendered datasets in any React project.
---

# Build Reusable React Lists

Inspect the project's component, styling, state, and naming conventions first. Adapt this pattern without introducing a competing UI system.

## Define the compound API

Build small list elements with one responsibility each:

- `List.Provider`: own shared list behavior.
- `List.Render`: render the visible collection.
- `List.Search`: debounce input and filter the source collection.
- `List.Sorter`: select a field and toggle direction.
- `List.Count`: show visible and total counts.
- `List.Marker`: select one stable item ID.
- `List.MarkerToggle`: select or clear all items.
- `List.MarkerPopup`: expose bulk actions when selection is non-empty.

Export the elements together so screens can compose them as one namespace.

## Keep state centralized

Let the provider coordinate:

- the complete source collection;
- the currently visible collection;
- the active sort field and direction;
- a `Set` of selected IDs;
- optional pointer-drag selection state.

Expose behavior through context instead of threading list-control props through every row. Type the context and item identity contract; avoid `any` when the data shape is known.

## Compose a list screen

```tsx
<List.Provider onSelectedChange={setSelected}>
    <List.Count />
    <List.Search onFilter={filterItems} />
    <ItemHeader />
    <List.Render data={items} getKey={(item) => item.id}>
        <ItemRow />
    </List.Render>
    <List.MarkerPopup>{bulkActions}</List.MarkerPopup>
</List.Provider>
```

Pass one row prototype to the renderer and inject each item through a consistent `data` or `item` prop. Keep the row and header as a pair, and keep their column widths and alignment identical.

## Implement behavior safely

- Filter from the complete source collection, not the already filtered result.
- Normalize the search query once and keep filter callbacks pure.
- Debounce text search before recomputing large collections.
- Sort a copied array; never mutate incoming props or store data.
- Support nested or derived sort values through a selector callback.
- Use stable item IDs for React keys and selection.
- Store selection in a `Set` for constant-time membership checks.
- Make single-selection behavior an explicit provider option.
- Reset or reconcile selection when the source collection changes.

## Preserve rendering performance

- Memoize derived collections, context values, callbacks, and expensive rows where measurement shows value.
- Avoid per-row state unless the state genuinely belongs to one row.
- Avoid recreating large data arrays during unrelated renders.
- Virtualize the visible collection when row counts are large enough that DOM size becomes the bottleneck.
- Measure before adding complexity; preserve the compound API when introducing pagination, server filtering, or virtualization.

Verify empty data, updated data, stable keys, search reset, ascending and descending sorting, single and bulk selection, and bulk actions.
