import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import TenantList from './TenantList';

const tenants = [
    { id: 1, name: 'Alice Wonderland', unit: 'A101', pms_tenant_id: 1, balance: '0.00' },
    { id: 3, name: 'Charlie Chaplin', unit: 'C303', pms_tenant_id: null, balance: '0.00' },
    { id: 4, name: 'Daisy Ridley', unit: 'C303', pms_tenant_id: 3, balance: '1240.10' },
    { id: 63, name: 'Yuki Anderson', unit: 'B516', pms_tenant_id: 62, balance: '-550.00' },
    { id: 2, name: 'Bob The Builder', unit: 'B205', pms_tenant_id: 2, balance: '2425.20' },
];

beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(tenants) }));
});

function SearchableTenantList() {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState({ column: null, direction: 'asc' });
    return (
        <TenantList
            onViewLedger={() => {}}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
        />
    );
}

async function renderAndSearch(text) {
    render(<SearchableTenantList />);
    await screen.findByText('Alice Wonderland');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tenants' }), { target: { value: text } });
}

function sortBy(label) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }));
}

function cellsFor(row) {
    return within(row).getAllByRole('cell').map(cell => cell.textContent);
}

function visibleNames() {
    return screen.getAllByRole('row').slice(1).map(row => cellsFor(row)[1]);
}

test('shows the PMS ID rather than the local ID', async () => {
    render(<SearchableTenantList />);

    expect(await screen.findByRole('columnheader', { name: 'PMS ID' })).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Daisy Ridley/ });
    expect(cellsFor(row).slice(0, 3)).toEqual(['3', 'Daisy Ridley', 'C303']);
});

test('flags a tenant that has no PMS ID', async () => {
    render(<SearchableTenantList />);

    const row = await screen.findByRole('row', { name: /Charlie Chaplin/ });
    expect(cellsFor(row).slice(0, 3)).toEqual(['Not in PMS', 'Charlie Chaplin', 'C303']);
    expect(screen.getAllByText('Not in PMS')).toHaveLength(1);
});

test('shows every tenant and the total before searching', async () => {
    render(<SearchableTenantList />);

    expect(await screen.findByText('Showing 5 of 5 tenants')).toBeInTheDocument();
});

test('searches by name, ignoring case', async () => {
    await renderAndSearch('yuki AND');

    expect(visibleNames()).toEqual(['Yuki Anderson']);
    expect(screen.getByText('Showing 1 of 5 tenants')).toBeInTheDocument();
});

test('searches by unit', async () => {
    await renderAndSearch('c303');

    expect(visibleNames()).toEqual(['Charlie Chaplin', 'Daisy Ridley']);
});

test('searches by PMS ID', async () => {
    await renderAndSearch('62');

    expect(visibleNames()).toEqual(['Yuki Anderson']);
});

test('finds tenants that are not in the PMS', async () => {
    await renderAndSearch('not in pms');

    expect(visibleNames()).toEqual(['Charlie Chaplin']);
});

test('says so when nothing matches', async () => {
    await renderAndSearch('  zzz ');

    expect(screen.getByText('No tenants match "zzz".')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 5 tenants')).toBeInTheDocument();
});

test('shows each tenant\'s balance as owed, credit, settled or no ledger', async () => {
    render(<SearchableTenantList />);

    await screen.findByText('Alice Wonderland');
    const balances = screen.getAllByRole('row').slice(1).map(row => cellsFor(row).slice(1, 4).filter((_, i) => i !== 1));
    expect(balances).toEqual([
        ['Alice Wonderland', 'Settled'],
        ['Charlie Chaplin', 'No ledger'],
        ['Daisy Ridley', '$1,240.10'],
        ['Yuki Anderson', '$550.00 credit'],
        ['Bob The Builder', '$2,425.20'],
    ]);
});

test('summarizes the balances of all tenants', async () => {
    render(<SearchableTenantList />);

    await screen.findByText('Alice Wonderland');
    expect(screen.getByText(/Outstanding/)).toHaveTextContent(
        'Outstanding $3,665.30 · 2 owing · 1 in credit ($550.00) · 1 settled · 1 not in PMS'
    );
});

test('the summary follows the search', async () => {
    await renderAndSearch('c303');

    expect(screen.getByText(/Outstanding/)).toHaveTextContent(
        'Outstanding $1,240.10 · 1 owing · 0 in credit ($0.00) · 0 settled · 1 not in PMS'
    );
});

test('keeps the order from the API until a column is sorted', async () => {
    render(<SearchableTenantList />);

    await screen.findByText('Alice Wonderland');
    expect(visibleNames()).toEqual(['Alice Wonderland', 'Charlie Chaplin', 'Daisy Ridley', 'Yuki Anderson', 'Bob The Builder']);
    expect(screen.getByRole('columnheader', { name: 'Balance' })).toHaveAttribute('aria-sort', 'none');
});

test('sorts by balance with the most owed first, then reverses', async () => {
    render(<SearchableTenantList />);
    await screen.findByText('Alice Wonderland');

    sortBy('Balance');
    expect(visibleNames()).toEqual(['Bob The Builder', 'Daisy Ridley', 'Alice Wonderland', 'Charlie Chaplin', 'Yuki Anderson']);
    expect(screen.getByRole('columnheader', { name: /Balance/ })).toHaveAttribute('aria-sort', 'descending');

    sortBy('Balance');
    expect(visibleNames()).toEqual(['Yuki Anderson', 'Alice Wonderland', 'Charlie Chaplin', 'Daisy Ridley', 'Bob The Builder']);
    expect(screen.getByRole('columnheader', { name: /Balance/ })).toHaveAttribute('aria-sort', 'ascending');
});

test('sorts by name', async () => {
    render(<SearchableTenantList />);
    await screen.findByText('Alice Wonderland');

    sortBy('Name');

    expect(visibleNames()).toEqual(['Alice Wonderland', 'Bob The Builder', 'Charlie Chaplin', 'Daisy Ridley', 'Yuki Anderson']);
});

test('sorts by PMS ID with tenants not in the PMS last in both directions', async () => {
    render(<SearchableTenantList />);
    await screen.findByText('Alice Wonderland');

    sortBy('PMS ID');
    expect(visibleNames()).toEqual(['Alice Wonderland', 'Bob The Builder', 'Daisy Ridley', 'Yuki Anderson', 'Charlie Chaplin']);

    sortBy('PMS ID');
    expect(visibleNames()).toEqual(['Yuki Anderson', 'Daisy Ridley', 'Bob The Builder', 'Alice Wonderland', 'Charlie Chaplin']);
});

test('sorts units in natural order', async () => {
    const units = ['A10', 'B1', 'A2'].map((unit, index) => (
        { id: index + 1, name: `Tenant ${unit}`, unit, pms_tenant_id: index + 1, balance: '0.00' }
    ));
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(units) }));
    render(<SearchableTenantList />);
    await screen.findByText('Tenant A10');

    sortBy('Unit');

    expect(visibleNames()).toEqual(['Tenant A2', 'Tenant A10', 'Tenant B1']);
});

test('sorts the tenants left by the search', async () => {
    await renderAndSearch('c303');

    sortBy('Balance');

    expect(visibleNames()).toEqual(['Daisy Ridley', 'Charlie Chaplin']);
});

test('the summary only mentions tenants not in the PMS when there are some', async () => {
    await renderAndSearch('alice');

    expect(screen.getByText(/Outstanding/)).toHaveTextContent(
        /^Outstanding \$0\.00 · 0 owing · 0 in credit \(\$0\.00\) · 1 settled$/
    );
});
