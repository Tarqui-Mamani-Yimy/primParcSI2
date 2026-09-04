import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/aether_theme.dart';
import '../providers/app_state.dart';
import 'home_screen.dart';
import 'collection_screen.dart';
import 'try_on_screen.dart';
import 'appointments_screen.dart';
import 'profile_screen.dart';
import 'cart_modal.dart';

class MainNavigationShell extends StatelessWidget {
  const MainNavigationShell({super.key});

  static const List<Widget> _screens = [
    HomeScreen(),
    CollectionScreen(),
    TryOnScreen(),
    AppointmentsScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return Scaffold(
      backgroundColor: AetherTheme.sandLight,
      appBar: AppBar(
        title: Text(
          'A E T H E R',
          style: GoogleFonts.outfit(
            fontSize: 17,
            letterSpacing: 4.5,
            fontWeight: FontWeight.w400,
            color: AetherTheme.charcoalDark,
          ),
        ),
        centerTitle: true,
        backgroundColor: AetherTheme.sandLight.withOpacity(0.95),
        elevation: 0,
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_bag_outlined, color: AetherTheme.charcoalDark, size: 22),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => const CartModal(),
                  );
                },
              ),
              if (appState.totalCartCount > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AetherTheme.charcoalDark,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      '${appState.totalCartCount}',
                      style: GoogleFonts.outfit(
                        color: AetherTheme.sandLight,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: IndexedStack(
        index: appState.currentTabIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AetherTheme.sandLight,
          border: Border(top: BorderSide(color: Color(0xFFCCC6BC), width: 0.5)),
        ),
        child: BottomNavigationBar(
          currentIndex: appState.currentTabIndex,
          onTap: (index) => appState.setTabIndex(index),
          type: BottomNavigationBarType.fixed,
          backgroundColor: AetherTheme.sandLight,
          selectedItemColor: AetherTheme.charcoalDark,
          unselectedItemColor: const Color(0xFF7B776E),
          selectedLabelStyle: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8),
          unselectedLabelStyle: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w500),
          elevation: 0,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home),
              label: 'Inicio',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.grid_view_outlined),
              activeIcon: Icon(Icons.grid_view),
              label: 'Colección',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.auto_awesome_outlined),
              activeIcon: Icon(Icons.auto_awesome),
              label: 'Probador',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.calendar_month_outlined),
              activeIcon: Icon(Icons.calendar_month),
              label: 'Citas',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person),
              label: 'Perfil',
            ),
          ],
        ),
      ),
    );
  }
}
