function Home({ setVista }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 p-6">
      <h1 className="text-4xl font-semibold">MacSomenos Servicios</h1>

      <div className="flex gap-6 flex-wrap justify-center">
        <button
          className="px-6 py-3 bg-white shadow rounded-2xl border hover:shadow-md hover:border-gray-400 transition text-lg"
          onClick={() => setVista('productos')}
        >
          Productos
        </button>
        <button className="px-6 py-3 bg-white shadow rounded-2xl border hover:shadow-md hover:border-gray-400 transition text-lg">
          Gastos
        </button>
        <button className="px-6 py-3 bg-white shadow rounded-2xl border hover:shadow-md hover:border-gray-400 transition text-lg">
          Calculadora
        </button>
      </div>
    </div>
  );
}

export default Home;
