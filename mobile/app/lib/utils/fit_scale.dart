/// Factor visual de "Silueta y Caída" (Relajado/Talla Real/Oversized) del
/// probador (CU11) — agranda o achica la foto/superposición de la prenda
/// en pantalla. Es puramente un efecto visual: nunca cambia el veredicto
/// real de ajuste (`determinarAjuste` en `size_chart.dart`), que se basa
/// solo en las medidas cargadas por el cliente.
const Map<String, double> fitModeScale = {
  'Relajado': 1.12,
  'Talla Real': 1.0,
  'Oversized': 1.3,
};

double fitModeFactor(String? fitMode) => fitModeScale[fitMode] ?? 1.0;
