import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/aether_theme.dart';

class AppointmentsScreen extends StatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  State<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends State<AppointmentsScreen> {
  int selectedService = 0;
  int selectedDateIndex = 0;
  String selectedTime = '10:00 AM';

  final _nameController = TextEditingController(text: 'Jane Doe');
  final _emailController = TextEditingController(text: 'jane@example.com');
  final _notesController = TextEditingController();

  final List<Map<String, String>> dates = [
    {'month': 'OCT', 'day': '12', 'dow': 'THU'},
    {'month': 'OCT', 'day': '13', 'dow': 'FRI'},
    {'month': 'OCT', 'day': '14', 'dow': 'SAT'},
    {'month': 'OCT', 'day': '15', 'dow': 'SUN'},
  ];

  final List<String> times = ['10:00 AM', '11:30 AM', '02:30 PM', '04:00 PM', '05:30 PM'];

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _confirm() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AetherTheme.sandLight,
        title: Text('Cita Confirmada', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text(
          'Tu cita para ${selectedService == 0 ? "Personal Shopping" : "Probador Privado"} el ${dates[selectedDateIndex]['day']} de ${dates[selectedDateIndex]['month']} a las $selectedTime ha sido agendada.',
          style: GoogleFonts.sourceSerif4(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text('ENTENDIDO', style: GoogleFonts.outfit(color: AetherTheme.charcoalDark, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bespoke Atelier Appointments', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w500, color: AetherTheme.charcoalDark)),
          const SizedBox(height: 4),
          Text(
            'Reserva una sesión con un estilista personal en nuestra suite privada.',
            style: GoogleFonts.sourceSerif4(fontSize: 12, color: const Color(0xFF4A463F)),
          ),
          const SizedBox(height: 16),

          // 1. Service Selection
          Text('1. SELECCIONAR SERVICIO', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.5, color: const Color(0xFF7B776E))),
          const SizedBox(height: 8),
          _serviceOption(0, 'In-store Personal Shopping', 'Sesión personalizada de 60 minutos con un estilista exclusivo.'),
          const SizedBox(height: 8),
          _serviceOption(1, 'Reserva de Probador & Prendas', 'Tus prendas y tallas seleccionadas preparadas con antelación.'),

          const SizedBox(height: 16),

          // 2. Date Selection
          Text('2. SELECCIONAR FECHA', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.5, color: const Color(0xFF7B776E))),
          const SizedBox(height: 8),
          SizedBox(
            height: 65,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: dates.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final d = dates[index];
                final isSel = selectedDateIndex == index;
                return InkWell(
                  onTap: () => setState(() => selectedDateIndex = index),
                  child: Container(
                    width: 60,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: isSel ? AetherTheme.charcoalDark : Colors.white.withOpacity(0.6),
                      border: Border.all(color: isSel ? AetherTheme.charcoalDark : const Color(0xFFCCC6BC)),
                      borderRadius: BorderRadius.circular(2),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(d['month']!, style: GoogleFonts.outfit(fontSize: 9, color: isSel ? AetherTheme.sandDark : const Color(0xFF7B776E))),
                        Text(d['day']!, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: isSel ? AetherTheme.sandLight : AetherTheme.charcoalDark)),
                        Text(d['dow']!, style: GoogleFonts.outfit(fontSize: 9, color: isSel ? AetherTheme.sandDark : const Color(0xFF7B776E))),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 16),

          // 3. Time Selection
          Text('3. HORARIO DISPONIBLE', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.5, color: const Color(0xFF7B776E))),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: times.map((t) {
              final isSel = selectedTime == t;
              return ChoiceChip(
                label: Text(t, style: GoogleFonts.outfit(fontSize: 11, fontWeight: isSel ? FontWeight.bold : FontWeight.w500)),
                selected: isSel,
                selectedColor: AetherTheme.charcoalDark,
                backgroundColor: Colors.white.withOpacity(0.6),
                side: const BorderSide(color: Color(0xFFCCC6BC), width: 0.6),
                labelStyle: TextStyle(color: isSel ? AetherTheme.sandLight : AetherTheme.charcoalDark),
                shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                showCheckmark: false,
                onSelected: (_) => setState(() => selectedTime = t),
              );
            }).toList(),
          ),

          const SizedBox(height: 16),

          // 4. Contact Inputs
          Text('4. DATOS DE CONTACTO', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.5, color: const Color(0xFF7B776E))),
          const SizedBox(height: 8),
          TextField(
            controller: _nameController,
            style: GoogleFonts.sourceSerif4(fontSize: 13),
            decoration: const InputDecoration(
              labelText: 'Nombre Completo',
              border: OutlineInputBorder(borderRadius: BorderRadius.zero),
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _emailController,
            style: GoogleFonts.sourceSerif4(fontSize: 13),
            decoration: const InputDecoration(
              labelText: 'Correo Electrónico',
              border: OutlineInputBorder(borderRadius: BorderRadius.zero),
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 20),

          // Submit CTA
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _confirm,
              style: ElevatedButton.styleFrom(
                backgroundColor: AetherTheme.charcoalDark,
                foregroundColor: AetherTheme.sandLight,
                shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
              ),
              child: Text('CONFIRMAR RESERVA', style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.8)),
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  Widget _serviceOption(int index, String title, String subtitle) {
    final isSel = selectedService == index;
    return InkWell(
      onTap: () => setState(() => selectedService = index),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSel ? Colors.white : Colors.white.withOpacity(0.4),
          border: Border.all(color: isSel ? AetherTheme.charcoalDark : const Color(0xFFCCC6BC)),
          borderRadius: BorderRadius.circular(2),
        ),
        child: Row(
          children: [
            Icon(
              isSel ? Icons.radio_button_checked : Icons.radio_button_off,
              color: isSel ? AetherTheme.charcoalDark : const Color(0xFF7B776E),
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600)),
                  Text(subtitle, style: GoogleFonts.sourceSerif4(fontSize: 11, color: const Color(0xFF4A463F))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
