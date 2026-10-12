import React, { useState } from 'react';
import './App.css';
import TenantList from './TenantList';
import TenantLedger from './TenantLedger';

function App() {
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ column: null, direction: 'asc' });

  return (
    <div className="App">
      <header className="App-header-minimal">
        <h1>Property Management Dashboard</h1>
      </header>
      <main className="App-main">
        {selectedTenant ? (
          <TenantLedger tenant={selectedTenant} onBack={() => setSelectedTenant(null)} />
        ) : (
          <TenantList
            onViewLedger={setSelectedTenant}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />
        )}
      </main>
    </div>
  );
}

export default App; 