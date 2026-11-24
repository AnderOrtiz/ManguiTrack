#!/usr/bin/env python3
"""
ManguiTrack - Prototipo funcional (consola) para Los Manguitos  |  Equipo: Chivo NET

Estructuras de datos y para qué se usan:
  * Diccionarios : catálogo, clientes y existencias por ubicación y SKU (acceso O(1)).
  * Listas       : ventas y bitácora (registro cronológico).
  * Cola (FIFO)  : pedidos pendientes, se atienden en orden de llegada (deque).
  * Pila (LIFO)  : acciones reversibles, se deshace primero lo último hecho.
  * Árbol        : categorías del catálogo.
  * Recursividad : stock total de una categoría y su impresión en árbol.
  * Grafo        : red central - bodegas - sucursales (lista de adyacencia con km).
  * BFS/Dijkstra : ruta con menos tramos y ruta de menor distancia.

Uso:
  python manguitrack.py          -> menú interactivo
  python manguitrack.py --demo   -> demostración automática con datos de ejemplo
"""
import heapq
import sys
from collections import deque
from datetime import datetime


class ErrorNegocio(ValueError):
    """Error de validación o regla de negocio (se muestra al usuario, no rompe el programa)."""


# ----------------------------------------------------------------------------
# Datos de ejemplo
# ----------------------------------------------------------------------------
UBICACIONES = {"CEN": "Central", "BN": "Bodega Norte", "BS": "Bodega Sur",
               "SS": "Suc. Soyapango", "SM": "Suc. San Miguel", "SA": "Suc. Santa Ana"}
BODEGAS = ("CEN", "BN", "BS")  # ubicaciones desde las que se despacha

PRODUCTOS = {  # diccionario: sku -> datos
    "P01": {"nombre": "Mango Tommy (caja)", "proveedor": "Finca El Sol", "precio": 12.50},
    "P02": {"nombre": "Piña (unidad)", "proveedor": "Finca El Sol", "precio": 1.80},
    "P03": {"nombre": "Limón (saco)", "proveedor": "Agro Cuscatlán", "precio": 9.00},
    "P04": {"nombre": "Jugo de mango 1L", "proveedor": "Néctares SV", "precio": 2.20},
    "P05": {"nombre": "Jugo de naranja 1L", "proveedor": "Néctares SV", "precio": 2.00},
    "P06": {"nombre": "Mermelada de mango", "proveedor": "Dulces del Valle", "precio": 3.40},
}
CLIENTES = {"C1": "Tienda La Esperanza", "C2": "Restaurante El Zonte",
            "C3": "Super Selectos Ilopango", "C4": "Comedor Doña Rosa"}

EXISTENCIAS_INICIALES = {  # diccionario anidado: ubicación -> sku -> cantidad
    "CEN": {"P01": 40, "P02": 80, "P03": 30, "P04": 120, "P05": 100, "P06": 60},
    "BN": {"P01": 25, "P02": 30, "P03": 15, "P04": 50, "P05": 40, "P06": 5},
    "BS": {"P01": 10, "P02": 45, "P03": 20, "P04": 30, "P05": 60, "P06": 25},
    "SS": {"P01": 6, "P02": 12, "P03": 4, "P04": 20, "P05": 18, "P06": 9},
    "SM": {"P01": 4, "P02": 8, "P03": 8, "P04": 15, "P05": 10, "P06": 3},
    "SA": {"P01": 8, "P02": 10, "P03": 6, "P04": 12, "P05": 14, "P06": 7},
}

# Árbol de categorías: las hojas guardan SKUs, los nodos internos guardan hijos.
ARBOL = {"nombre": "Catálogo", "hijos": [
    {"nombre": "Frutas frescas", "hijos": [
        {"nombre": "Tropicales", "productos": ["P01", "P02"]},
        {"nombre": "Cítricos", "productos": ["P03"]}]},
    {"nombre": "Procesados", "hijos": [
        {"nombre": "Jugos", "productos": ["P04", "P05"]},
        {"nombre": "Conservas", "productos": ["P06"]}]}]}

TRAMOS = [("CEN", "BN", 60), ("CEN", "BS", 45), ("CEN", "SS", 12), ("BN", "SA", 40),
          ("BN", "SS", 55), ("BS", "SM", 70), ("SS", "SM", 95)]


class ManguiTrack:
    def __init__(self):
        self.existencias = {u: dict(p)
                            for u, p in EXISTENCIAS_INICIALES.items()}
        # lista de adyacencia ponderada
        self.grafo = {u: {} for u in UBICACIONES}
        for a, b, km in TRAMOS:
            self.grafo[a][b] = km
            self.grafo[b][a] = km
        self.ventas = []                                   # lista
        self.bitacora = []                                 # lista
        self.cola_pedidos = deque()                        # cola FIFO
        self.pila_deshacer = []                            # pila LIFO
        self._n_venta = self._n_pedido = 1

    # ------------------------- validaciones -------------------------
    @staticmethod
    def cantidad(valor):
        """Convierte a entero > 0; rechaza vacíos, texto, decimales y negativos."""
        try:
            n = int(str(valor).strip())
        except ValueError:
            raise ErrorNegocio(
                "La cantidad debe ser un número entero mayor que cero.")
        if n <= 0:
            raise ErrorNegocio(
                "La cantidad debe ser un número entero mayor que cero.")
        return n

    def _ubic(self, u):
        u = str(u).strip().upper()
        if u not in UBICACIONES:
            raise ErrorNegocio(f"Ubicación inválida: '{u}'.")
        return u

    def _sku(self, s):
        s = str(s).strip().upper()
        if s not in PRODUCTOS:
            raise ErrorNegocio(f"Producto inválido: '{s}'.")
        return s

    def _cli(self, c):
        c = str(c).strip().upper()
        if c not in CLIENTES:
            raise ErrorNegocio(f"Cliente inválido: '{c}'.")
        return c

    def stock(self, ubic, sku):
        return self.existencias[ubic].get(sku, 0)

    def stock_total(self, sku):
        return sum(e.get(sku, 0) for e in self.existencias.values())

    def _mover(self, origen, destino, sku, cant):
        self.existencias[origen][sku] -= cant
        self.existencias[destino][sku] = self.stock(destino, sku) + cant

    def _log(self, tipo, detalle):
        self.bitacora.append(
            (datetime.now().strftime("%H:%M:%S"), tipo, detalle))

    # ------------------------- inventario -------------------------
    def entrada(self, ubic, sku, cant):
        ubic, sku, cant = self._ubic(ubic), self._sku(sku), self.cantidad(cant)
        self.existencias[ubic][sku] = self.stock(ubic, sku) + cant
        self._log("Entrada", f"{cant} x {PRODUCTOS[sku]['nombre']} en {UBICACIONES[ubic]} "
                  f"(proveedor {PRODUCTOS[sku]['proveedor']})")

        def revertir():
            self.existencias[ubic][sku] -= cant
        self.pila_deshacer.append((f"Entrada {sku} x{cant}", revertir))
        return f"Entrada registrada: {cant} x {PRODUCTOS[sku]['nombre']} en {UBICACIONES[ubic]}."

    # ------------------------- ventas -------------------------
    def vender(self, ubic, cliente, sku, cant):
        ubic, cliente, sku = self._ubic(
            ubic), self._cli(cliente), self._sku(sku)
        cant = self.cantidad(cant)
        if self.stock(ubic, sku) < cant:
            raise ErrorNegocio(f"Existencias insuficientes: {UBICACIONES[ubic]} tiene "
                               f"{self.stock(ubic, sku)} de {PRODUCTOS[sku]['nombre']}.")
        self.existencias[ubic][sku] -= cant
        venta = {"id": f"V{self._n_venta}", "cliente": CLIENTES[cliente], "sku": sku,
                 "cantidad": cant, "total": cant * PRODUCTOS[sku]["precio"], "ubicacion": ubic}
        self._n_venta += 1
        self.ventas.append(venta)
        self._log("Venta", f"{venta['id']}: {cant} x {PRODUCTOS[sku]['nombre']} a "
                  f"{venta['cliente']} desde {UBICACIONES[ubic]}")

        def revertir():
            self.existencias[ubic][sku] += cant
            self.ventas.remove(venta)
        self.pila_deshacer.append((f"Venta {venta['id']}", revertir))
        return f"Venta {venta['id']} registrada por ${venta['total']:.2f}."

    # ------------------------- grafo: rutas -------------------------
    def dijkstra(self, origen, destino):
        """Ruta de menor distancia. Devuelve (km, [ubicaciones]) o None si no hay ruta."""
        dist = {u: float("inf") for u in self.grafo}
        previo, dist[origen] = {}, 0
        monticulo = [(0, origen)]
        while monticulo:
            d, u = heapq.heappop(monticulo)
            if d > dist[u]:
                continue
            for v, km in self.grafo[u].items():
                if d + km < dist[v]:
                    dist[v], previo[v] = d + km, u
                    heapq.heappush(monticulo, (dist[v], v))
        if dist[destino] == float("inf"):
            return None
        ruta, n = [destino], destino
        while n != origen:
            n = previo[n]
            ruta.append(n)
        return dist[destino], ruta[::-1]

    def bfs(self, origen, destino):
        """Ruta con menos tramos, usando una cola. Devuelve lista o None."""
        cola, visitados = deque([[origen]]), {origen}
        while cola:
            camino = cola.popleft()
            if camino[-1] == destino:
                return camino
            for vecino in self.grafo[camino[-1]]:
                if vecino not in visitados:
                    visitados.add(vecino)
                    cola.append(camino + [vecino])
        return None

    def consultar_ruta(self, origen, destino):
        origen, destino = self._ubic(origen), self._ubic(destino)
        if origen == destino:
            raise ErrorNegocio("Elige ubicaciones distintas.")
        d, w = self.dijkstra(origen, destino), self.bfs(origen, destino)
        if not d:
            raise ErrorNegocio("No existe ruta entre esas ubicaciones.")

        def nombres(r): return " -> ".join(UBICACIONES[x] for x in r)
        return (f"Menor distancia (Dijkstra): {nombres(d[1])} ({d[0]} km)\n"
                f"Menos tramos (BFS):         {nombres(w)} ({len(w) - 1} tramos)")

    # ------------------------- transferencias -------------------------
    def transferir(self, origen, destino, sku, cant):
        origen, destino, sku = self._ubic(
            origen), self._ubic(destino), self._sku(sku)
        cant = self.cantidad(cant)
        if origen == destino:
            raise ErrorNegocio("Origen y destino deben ser distintos.")
        if self.stock(origen, sku) < cant:
            raise ErrorNegocio(f"Existencias insuficientes en {UBICACIONES[origen]} "
                               f"({self.stock(origen, sku)} disponibles).")
        ruta = self.dijkstra(origen, destino)
        if not ruta:
            raise ErrorNegocio("No existe ruta entre esas ubicaciones.")
        self._mover(origen, destino, sku, cant)
        camino = " -> ".join(UBICACIONES[x] for x in ruta[1])
        self._log("Transferencia",
                  f"{cant} x {PRODUCTOS[sku]['nombre']}: {camino} ({ruta[0]} km)")
        self.pila_deshacer.append((f"Transferencia {sku} x{cant}",
                                   lambda: self._mover(destino, origen, sku, cant)))
        return f"Transferencia realizada por {ruta[0]} km: {camino}."

    # ------------------------- pedidos (cola) -------------------------
    def crear_pedido(self, cliente, destino, sku, cant):
        cliente, destino, sku = self._cli(
            cliente), self._ubic(destino), self._sku(sku)
        cant = self.cantidad(cant)
        if destino in BODEGAS:
            raise ErrorNegocio(
                "El destino de un pedido debe ser una sucursal.")
        pedido = {"id": f"PD{self._n_pedido}", "cliente": CLIENTES[cliente],
                  "destino": destino, "sku": sku, "cantidad": cant}
        self._n_pedido += 1
        self.cola_pedidos.append(pedido)                   # entra al final
        self._log("Pedido", f"{pedido['id']} en cola: {cant} x {PRODUCTOS[sku]['nombre']} "
                  f"para {UBICACIONES[destino]}")
        return f"Pedido {pedido['id']} en cola (posición {len(self.cola_pedidos)})."

    def despachar(self):
        if not self.cola_pedidos:
            raise ErrorNegocio(
                "La cola está vacía: no hay pedidos por despachar.")
        p = self.cola_pedidos[0]                           # frente de la cola
        mejor = None                                       # (km, ruta, bodega)
        for b in BODEGAS:
            if self.stock(b, p["sku"]) >= p["cantidad"]:
                r = self.dijkstra(b, p["destino"])
                if r and (mejor is None or r[0] < mejor[0]):
                    mejor = (r[0], r[1], b)
        if mejor is None:
            raise ErrorNegocio(f"{p['id']} sigue en cola: ninguna bodega tiene "
                               f"{p['cantidad']} x {PRODUCTOS[p['sku']]['nombre']}.")
        self.cola_pedidos.popleft()
        km, ruta, origen = mejor
        self._mover(origen, p["destino"], p["sku"], p["cantidad"])
        camino = " -> ".join(UBICACIONES[x] for x in ruta)
        self._log(
            "Despacho", f"{p['id']}: desde {UBICACIONES[origen]} por {camino} ({km} km)")

        def revertir():
            self._mover(p["destino"], origen, p["sku"], p["cantidad"])
            self.cola_pedidos.appendleft(p)                # vuelve al frente
        self.pila_deshacer.append((f"Despacho {p['id']}", revertir))
        return f"{p['id']} despachado desde {UBICACIONES[origen]} ({km} km): {camino}."

    # ------------------------- deshacer (pila) -------------------------
    def deshacer(self):
        if not self.pila_deshacer:
            raise ErrorNegocio("No hay operaciones para deshacer.")
        descripcion, revertir = self.pila_deshacer.pop()   # tope de la pila
        revertir()
        self._log("Reversión", descripcion)
        return f"Se revirtió: {descripcion}."

    # ------------------------- árbol y recursividad -------------------------
    def stock_categoria(self, nodo):
        if "productos" in nodo:                            # caso base: hoja
            return sum(self.stock_total(s) for s in nodo["productos"])
        # caso recursivo
        return sum(self.stock_categoria(h) for h in nodo["hijos"])

    def arbol_texto(self, nodo=None, nivel=0):
        nodo = nodo or ARBOL
        lineas = [
            f"{'    ' * nivel}- {nodo['nombre']}: {self.stock_categoria(nodo)} uds"]
        if "productos" in nodo:
            lineas += [f"{'    ' * (nivel + 1)}* {PRODUCTOS[s]['nombre']}: {self.stock_total(s)}"
                       for s in nodo["productos"]]
        else:
            for h in nodo["hijos"]:
                lineas += self.arbol_texto(h, nivel + 1).split("\n")
        return "\n".join(lineas)

    # ------------------------- reportes -------------------------
    def inventario_texto(self):
        enc = f"{'SKU':<5}{'Producto':<22}" + \
            "".join(f"{u:>5}" for u in UBICACIONES) + f"{'Total':>7}"
        filas = [enc, "-" * len(enc)]
        for sku, p in PRODUCTOS.items():
            celdas = "".join(f"{self.stock(u, sku):>4}{'!' if self.stock(u, sku) < 8 else ' '}"
                             for u in UBICACIONES)
            filas.append(
                f"{sku:<5}{p['nombre']:<22}{celdas}{self.stock_total(sku):>7}")
        return "\n".join(filas + ["('!' = existencias bajas, menos de 8)"])

    def ventas_texto(self):
        if not self.ventas:
            return "Aún no hay ventas."
        return "\n".join(f"{v['id']:<5}{v['cliente']:<26}{v['cantidad']:>4} x "
                         f"{PRODUCTOS[v['sku']]['nombre']:<22}${v['total']:>8.2f}" for v in self.ventas)

    def cola_texto(self):
        if not self.cola_pedidos:
            return "No hay pedidos pendientes."
        return "\n".join(f"{'->' if i == 0 else '  '} {p['id']:<5}{p['cliente']:<26}"
                         f"{p['cantidad']:>4} x {PRODUCTOS[p['sku']]['nombre']:<22}"
                         f"{UBICACIONES[p['destino']]}" for i, p in enumerate(self.cola_pedidos))

    def bitacora_texto(self):
        if not self.bitacora:
            return "Todavía no hay movimientos."
        return "\n".join(f"{h}  {t:<14}{d}" for h, t, d in reversed(self.bitacora))

    def pila_texto(self):
        if not self.pila_deshacer:
            return "Pila vacía."
        return "\n".join(f"{'tope ->' if i == 0 else '       '} {d}"
                         for i, (d, _) in enumerate(reversed(self.pila_deshacer)))


# ----------------------------------------------------------------------------
# Interfaz de consola
# ----------------------------------------------------------------------------
def pedir(texto, opciones=None):
    """Lee un dato; si hay opciones, las muestra como ayuda."""
    if opciones:
        print("   " + " | ".join(f"{k}={v}" for k, v in opciones.items()))
    return input(f"   {texto}: ").strip()


def ejecutar(accion, *args):
    """Ejecuta una operación y muestra el resultado o el error de validación."""
    try:
        print("  OK ->", accion(*args))
    except ErrorNegocio as e:
        print("  ERROR ->", e)


def menu():
    s = ManguiTrack()
    productos = {k: v["nombre"] for k, v in PRODUCTOS.items()}
    opciones = """
=========== ManguiTrack · Los Manguitos ===========
 1. Ver inventario            6. Consultar rutas
 2. Registrar entrada         7. Árbol de categorías
 3. Registrar venta           8. Bitácora y pila de deshacer
 4. Crear pedido (cola)       9. Deshacer última operación
 5. Despachar siguiente       10. Transferir entre ubicaciones
 11. Ver ventas y cola        0. Salir
==================================================="""
    while True:
        print(opciones)
        op = input("Opción: ").strip()
        if op == "0":
            print("Hasta pronto.")
            break
        elif op == "1":
            print(s.inventario_texto())
        elif op == "2":
            ejecutar(s.entrada, pedir("Ubicación", UBICACIONES), pedir("Producto", productos),
                     pedir("Cantidad"))
        elif op == "3":
            ejecutar(s.vender, pedir("Ubicación", UBICACIONES), pedir("Cliente", CLIENTES),
                     pedir("Producto", productos), pedir("Cantidad"))
        elif op == "4":
            ejecutar(s.crear_pedido, pedir("Cliente", CLIENTES), pedir("Destino (sucursal)", UBICACIONES),
                     pedir("Producto", productos), pedir("Cantidad"))
        elif op == "5":
            ejecutar(s.despachar)
        elif op == "6":
            ejecutar(s.consultar_ruta, pedir(
                "Origen", UBICACIONES), pedir("Destino"))
        elif op == "7":
            print(s.arbol_texto())
        elif op == "8":
            print("BITÁCORA (más reciente primero)\n" + s.bitacora_texto())
            print("\nPILA DE DESHACER\n" + s.pila_texto())
        elif op == "9":
            ejecutar(s.deshacer)
        elif op == "10":
            ejecutar(s.transferir, pedir("Origen", UBICACIONES), pedir("Destino"),
                     pedir("Producto", productos), pedir("Cantidad"))
        elif op == "11":
            print("VENTAS\n" + s.ventas_texto() +
                  "\n\nCOLA DE PEDIDOS (-> sale primero)\n" + s.cola_texto())
        else:
            print("  ERROR -> Opción no válida.")


def demo():
    """Recorre los procesos principales con datos de ejemplo y verifica resultados."""
    s = ManguiTrack()
    def paso(t): return print(f"\n### {t}")

    def intentar(accion, *a):
        try:
            print("  OK ->", accion(*a))
        except ErrorNegocio as e:
            print("  ERROR ->", e)

    paso("1. Inventario inicial")
    print(s.inventario_texto())
    paso("2. Venta de 5 cajas de mango en Soyapango")
    intentar(s.vender, "SS", "C1", "P01", 5)
    assert s.stock("SS", "P01") == 1
    paso("3. Pedidos en cola (FIFO)")
    intentar(s.crear_pedido, "C2", "SM", "P04", 20)
    intentar(s.crear_pedido, "C3", "SA", "P06", 40)
    print(s.cola_texto())
    paso("4. Despachos: el primero en entrar es el primero en salir")
    intentar(s.despachar)
    assert s.stock("BS", "P04") == 10 and s.stock("SM", "P04") == 35
    intentar(s.despachar)
    assert s.stock("CEN", "P06") == 20 and s.stock("SA", "P06") == 47
    paso("5. Rutas de la Central a San Miguel")
    print(s.consultar_ruta("CEN", "SM"))
    paso("6. Transferencia de 10 jugos de naranja de Bodega Sur a Bodega Norte")
    intentar(s.transferir, "BS", "BN", "P05", 10)
    paso("7. Árbol de categorías con recursividad")
    print(s.arbol_texto())
    paso("8. Deshacer (pila LIFO): se revierte la transferencia primero")
    print(s.pila_texto())
    intentar(s.deshacer)
    assert s.stock("BS", "P05") == 60
    paso("9. Validaciones (todas deben dar ERROR)")
    for accion, args in [(s.vender, ("SM", "C1", "P01", 50)), (s.vender, ("SM", "C1", "P01", 0)),
                         (s.vender, ("SM", "C1", "P01", "2.5")
                          ), (s.vender, ("SM", "C1", "P01", "")),
                         (s.transferir, ("CEN", "CEN", "P01", 1)
                          ), (s.crear_pedido, ("C1", "CEN", "P01", 1)),
                         (s.consultar_ruta, ("SA", "SA")), (s.vender, ("XX", "C1", "P01", 1))]:
        intentar(accion, *args)
    s.crear_pedido("C4", "SA", "P03", 500)
    intentar(s.despachar)
    assert len(s.cola_pedidos) == 1
    s.cola_pedidos.clear()
    intentar(s.despachar)
    s.pila_deshacer.clear()
    intentar(s.deshacer)
    paso("10. Bitácora")
    print(s.bitacora_texto())
    print("\nDemostración completada: todas las comprobaciones pasaron.")


if __name__ == "__main__":
    demo() if "--demo" in sys.argv else menu()
