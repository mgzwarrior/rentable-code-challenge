import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import TenantList from './TenantList';

const tenants = [
    { id: 1, name: 'Alice Wonderland', unit: 'A101', pms_tenant_id: 1 },
    { id: 3, name: 'Charlie Chaplin', unit: 'C303', pms_tenant_id: null },
    { id: 4, name: 'Daisy Ridley', unit: 'C303', pms_tenant_id: 3 },
    { id: 63, name: 'Yuki Anderson', unit: 'B516', pms_tenant_id: 62 },
];

beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(tenants) }));
});

function SearchableTenantList() {
    const [search, setSearch] = useState('');
    return <TenantList onViewLedger={() => {}} search={search} onSearchChange={setSearch} />;
}

async function renderAndSearch(text) {
    render(<SearchableTenantList />);
    await screen.findByText('Alice Wonderland');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tenants' }), { target: { value: text } });
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

    expect(await screen.findByText('Showing 4 of 4 tenants')).toBeInTheDocument();
});

test('searches by name, ignoring case', async () => {
    await renderAndSearch('yuki AND');

    expect(visibleNames()).toEqual(['Yuki Anderson']);
    expect(screen.getByText('Showing 1 of 4 tenants')).toBeInTheDocument();
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
    expect(screen.getByText('Showing 0 of 4 tenants')).toBeInTheDocument();
});
