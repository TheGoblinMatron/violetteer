/**
 * App.jsx - Main routing component
 *
 * REFACTORED VERSION:
 * All API logic has been extracted into custom hooks:
 * - usePlants() - handles plant catalog CRUD
 * - useLists() - handles user lists and list membership
 *
 * This file now focuses on:
 * 1. Setting up providers (AuthProvider)
 * 2. Defining routes
 * 3. Connecting hooks to components via props
 *
 * BEFORE: ~330 lines with inline fetch calls
 * AFTER: ~120 lines focused on routing/layout
 */
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import PlantCatalog from './components/PlantCatalog';
import ListView from './components/ListView';
import PlantDetail from './components/PlantDetail';
import SettingsPage from './components/SettingsPage';
import PublicProfilePage from './components/PublicProfilePage';
import AdminDashboard from './components/AdminDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { usePlants } from './hooks/usePlants';
import { useLists } from './hooks/useLists';

/**
 * App - Root component that sets up providers
 *
 * AuthProvider must wrap everything that needs auth.
 * BrowserRouter must wrap everything that uses routing.
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

/**
 * AppContent - The actual app that uses hooks
 *
 * Separated from App because hooks (useAuth, usePlants, useLists)
 * can only be called inside their respective providers.
 */
function AppContent() {
  const { loading: authLoading } = useAuth();

  // Use our custom hooks - all the API logic is encapsulated here
  const {
    catalogPlants,
    allPlants,           // Includes catalog + user's custom plants (for autocomplete)
    loading: plantsLoading,
    allPlantsLoading,    // True while lazy-loading all plants
    pagination,          // Pagination metadata { page, limit, total, totalPages }
    fetchCatalogPage,    // Function to fetch a specific page
    fetchAllPlants,      // Lazy-load all plants when needed
    addPlant,
    updatePlant,
    deletePlant,
    refetch: refetchPlants,
  } = usePlants();

  const {
    lists,
    loading: listsLoading,
    createList,
    updateList,
    addToList,
    removeFromList,
    updateNotes,
    getListsForPlant,
    refetch: refetchLists,
  } = useLists();

  /**
   * Create a plant and immediately add it to a list
   *
   * This is a "composite" operation that uses both hooks.
   * It's fine to keep this in App.jsx since it coordinates between domains.
   */
  const handleCreatePlantAndAddToList = async (plantData, listId) => {
    const plant = await addPlant(plantData);
    if (plant) {
      await addToList(listId, plant.id);
    }
  };

  /**
   * Delete a plant and refresh lists
   *
   * When a plant is deleted, it might be in lists, so we refetch.
   */
  const handleDeletePlant = async (plantId) => {
    await deletePlant(plantId);
    await refetchLists(); // Lists might have contained this plant
  };

  // Show loading while any data is being fetched
  if (authLoading || plantsLoading || listsLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Layout lists={lists} onCreateList={createList}>
      <Routes>
        {/* Catalog - browse all plants */}
        <Route
          path="/"
          element={
            <PlantCatalog
              plants={catalogPlants}
              lists={lists}
              pagination={pagination}
              onPageChange={fetchCatalogPage}
              onAddPlant={addPlant}
              onAddToList={addToList}
              onRemoveFromList={removeFromList}
              getListsForPlant={getListsForPlant}
            />
          }
        />

        {/* List view - uses URL param to find the list */}
        <Route
          path="/list/:id"
          element={
            <ListViewWrapper
              lists={lists}
              allPlants={allPlants}
              allPlantsLoading={allPlantsLoading}
              fetchAllPlants={fetchAllPlants}
              onRemoveFromList={removeFromList}
              onUpdateNotes={updateNotes}
              onAddToList={addToList}
              onUpdateList={updateList}
              onCreatePlant={handleCreatePlantAndAddToList}
            />
          }
        />

        {/* Plant detail page */}
        <Route
          path="/plant/:id"
          element={
            <PlantDetailWrapper
              allPlants={allPlants}
              allPlantsLoading={allPlantsLoading}
              fetchAllPlants={fetchAllPlants}
              lists={lists}
              onAddToList={addToList}
              onRemoveFromList={removeFromList}
              onUpdateNotes={updateNotes}
              onUpdatePlant={updatePlant}
              onDeletePlant={handleDeletePlant}
              onCreateList={createList}
              getListsForPlant={getListsForPlant}
            />
          }
        />

        {/* User settings page (private) */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* Public user profile page */}
        <Route path="/user/:username" element={<PublicProfilePage />} />

        {/* Admin dashboard (admin only) */}
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Layout>
  );
}

/**
 * ListViewWrapper - Wrapper that extracts list ID from URL params
 *
 * This allows us to use a single route "/list/:id" instead of
 * dynamically creating routes for each list. This fixes issues
 * where navigating to a list URL before lists are loaded would
 * result in "no routes matched" errors.
 *
 * OPTIMIZATION: Triggers lazy-loading of all plants when visiting a list.
 * This data is needed for the "Add Plant" dialog's autocomplete.
 */
function ListViewWrapper({ lists, allPlants, allPlantsLoading, fetchAllPlants, onRemoveFromList, onUpdateNotes, onAddToList, onUpdateList, onCreatePlant }) {
  const { id } = useParams();
  const list = lists.find(l => l.id === parseInt(id));

  // Trigger lazy-load of all plants when user visits a list
  // This data is needed for the "Add Plant" dialog
  useEffect(() => {
    fetchAllPlants();
  }, [fetchAllPlants]);

  if (!list) {
    return <div>List not found</div>;
  }

  return (
    <ListView
      list={list}
      allPlants={allPlants}
      allPlantsLoading={allPlantsLoading}
      onRemoveFromList={onRemoveFromList}
      onUpdateNotes={onUpdateNotes}
      onAddToList={onAddToList}
      onUpdateList={onUpdateList}
      onCreatePlant={onCreatePlant}
      lists={lists}
    />
  );
}

/**
 * PlantDetailWrapper - Wrapper that triggers lazy-loading of all plants
 *
 * OPTIMIZATION: Triggers lazy-loading of all plants when visiting a plant detail.
 * This ensures custom plants (not in catalog) can be found.
 */
function PlantDetailWrapper({ allPlants, allPlantsLoading, fetchAllPlants, lists, onAddToList, onRemoveFromList, onUpdateNotes, onUpdatePlant, onDeletePlant, onCreateList, getListsForPlant }) {
  // Trigger lazy-load of all plants when user visits plant detail
  useEffect(() => {
    fetchAllPlants();
  }, [fetchAllPlants]);

  // Show loading while fetching plants
  if (allPlantsLoading && allPlants.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        Loading...
      </div>
    );
  }

  return (
    <PlantDetail
      plants={allPlants}
      lists={lists}
      onAddToList={onAddToList}
      onRemoveFromList={onRemoveFromList}
      onUpdateNotes={onUpdateNotes}
      onUpdatePlant={onUpdatePlant}
      onDeletePlant={onDeletePlant}
      onCreateList={onCreateList}
      getListsForPlant={getListsForPlant}
    />
  );
}
