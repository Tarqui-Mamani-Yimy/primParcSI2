import 'package:flutter/material.dart';
import '../models/product_model.dart';
import '../services/auth_service.dart';

class CartItem {
  final Product product;
  final String size;
  int quantity;

  CartItem({
    required this.product,
    required this.size,
    this.quantity = 1,
  });
}

class AppState extends ChangeNotifier {
  int _currentTabIndex = 0;
  int get currentTabIndex => _currentTabIndex;

  final List<Product> _products = List.from(dummyProducts);
  List<Product> get products => _products;

  final List<CartItem> _cart = [];
  List<CartItem> get cart => _cart;

  late Product _selectedTryOnProduct;
  Product get selectedTryOnProduct => _selectedTryOnProduct;

  late AvatarModel _selectedAvatar;
  AvatarModel get selectedAvatar => _selectedAvatar;

  String _fitMode = 'A tu talla';
  String get fitMode => _fitMode;

  String _selectedSize = 'M';
  String get selectedSize => _selectedSize;

  bool _isSimulatingTryOn = false;
  bool get isSimulatingTryOn => _isSimulatingTryOn;

  UserProfile _userProfile = dummyUserProfile;
  UserProfile get userProfile => _userProfile;

  // ---------------------------------------------------------------------------
  // Sesion / autenticacion contra el backend
  // ---------------------------------------------------------------------------

  final AuthService _authService;

  AuthUser? _usuario;
  AuthUser? get usuario => _usuario;

  String? _accessToken;
  String? get accessToken => _accessToken;

  bool get estaAutenticado => _usuario != null;

  bool _esInvitado = false;
  bool get esInvitado => _esInvitado;

  bool _authCargando = false;
  bool get authCargando => _authCargando;

  /// Mensaje del ultimo error de autenticacion, listo para mostrarse.
  String? _authError;
  String? get authError => _authError;

  /// Intentos que le quedan al usuario antes de que se bloquee la cuenta.
  int? _intentosRestantes;
  int? get intentosRestantes => _intentosRestantes;

  bool _cuentaBloqueada = false;
  bool get cuentaBloqueada => _cuentaBloqueada;

  AppState({AuthService? authService})
      : _authService = authService ?? AuthService() {
    _selectedTryOnProduct = _products[0];
    _selectedAvatar = dummyAvatars[0];
  }

  void limpiarAuthError() {
    if (_authError == null) return;
    _authError = null;
    notifyListeners();
  }

  /// Inicia sesion contra `POST /api/auth/login`.
  /// Devuelve `true` si la sesion se abrio correctamente.
  Future<bool> login(String correo, String password) async {
    _authCargando = true;
    _authError = null;
    notifyListeners();

    try {
      final sesion = await _authService.login(correo: correo, password: password);
      _aplicarSesion(sesion);
      return true;
    } on AuthException catch (e) {
      _authError = e.message;
      _intentosRestantes = e.intentosRestantes;
      _cuentaBloqueada = e.cuentaBloqueada;
      return false;
    } finally {
      _authCargando = false;
      notifyListeners();
    }
  }

  /// Registra un usuario nuevo con `POST /api/auth/register`.
  /// El backend valida la politica de contrasenas y devuelve 422 si no se cumple.
  Future<bool> registrar({
    required String nombre,
    required String correo,
    required String password,
  }) async {
    _authCargando = true;
    _authError = null;
    notifyListeners();

    try {
      final sesion = await _authService.register(
        nombre: nombre,
        correo: correo,
        password: password,
      );
      _aplicarSesion(sesion);
      return true;
    } on AuthException catch (e) {
      _authError = e.message;
      return false;
    } finally {
      _authCargando = false;
      notifyListeners();
    }
  }

  /// Entra al catalogo sin iniciar sesion (modo demo / invitado).
  void continuarComoInvitado() {
    _esInvitado = true;
    _authError = null;
    notifyListeners();
  }

  void cerrarSesion() {
    _usuario = null;
    _accessToken = null;
    _esInvitado = false;
    _authError = null;
    _intentosRestantes = null;
    _cuentaBloqueada = false;
    _currentTabIndex = 0;
    notifyListeners();
  }

  void _aplicarSesion(AuthSession sesion) {
    _usuario = sesion.usuario;
    _accessToken = sesion.accessToken;
    _esInvitado = false;
    _authError = null;
    _intentosRestantes = null;
    _cuentaBloqueada = false;
    _userProfile = _userProfile.copyWith(
      name: sesion.usuario.nombre,
      email: sesion.usuario.correo,
    );
  }

  @override
  void dispose() {
    _authService.dispose();
    super.dispose();
  }

  void setTabIndex(int index) {
    _currentTabIndex = index;
    notifyListeners();
  }

  int get totalCartCount => _cart.fold(0, (sum, item) => sum + item.quantity);

  double get cartSubtotal => _cart.fold(0.0, (sum, item) => sum + (item.product.price * item.quantity));

  void addToCart(Product product, String size) {
    final existingIndex = _cart.indexWhere(
      (item) => item.product.id == product.id && item.size == size,
    );

    if (existingIndex >= 0) {
      _cart[existingIndex].quantity += 1;
    } else {
      _cart.add(CartItem(product: product, size: size, quantity: 1));
    }
    notifyListeners();
  }

  void removeFromCart(int index) {
    if (index >= 0 && index < _cart.length) {
      _cart.removeAt(index);
      notifyListeners();
    }
  }

  void updateCartQuantity(int index, int delta) {
    if (index >= 0 && index < _cart.length) {
      final newQty = _cart[index].quantity + delta;
      if (newQty <= 0) {
        _cart.removeAt(index);
      } else {
        _cart[index].quantity = newQty;
      }
      notifyListeners();
    }
  }

  void clearCart() {
    _cart.clear();
    notifyListeners();
  }

  void selectTryOnProduct(Product product) {
    _selectedTryOnProduct = product;
    _selectedSize = product.sizes.isNotEmpty ? product.sizes[0] : 'M';
    runSimulation();
    notifyListeners();
  }

  void selectAvatar(AvatarModel avatar) {
    _selectedAvatar = avatar;
    runSimulation();
    notifyListeners();
  }

  void setFitMode(String mode) {
    _fitMode = mode;
    runSimulation();
    notifyListeners();
  }

  void setSelectedSize(String size) {
    _selectedSize = size;
    notifyListeners();
  }

  void runSimulation() {
    _isSimulatingTryOn = true;
    notifyListeners();
    Future.delayed(const Duration(milliseconds: 650), () {
      _isSimulatingTryOn = false;
      notifyListeners();
    });
  }

  void saveLookToProfile() {
    final newLook = OutfitLook(
      id: 'look-${DateTime.now().millisecondsSinceEpoch}',
      title: 'LOOK - ${_selectedTryOnProduct.name.toUpperCase()}',
      subtitle: '${_selectedTryOnProduct.category} · corte $_fitMode',
      imageUrl: _selectedTryOnProduct.imageUrl,
      items: [_selectedTryOnProduct.name],
      palette: [_selectedTryOnProduct.colorHex, '#171612', '#DDD9D8'],
    );

    final updatedOutfits = [newLook, ..._userProfile.savedOutfits];
    _userProfile = _userProfile.copyWith(savedOutfits: updatedOutfits);
    notifyListeners();
  }

  void updateMeasurements(int height, int chest, int waist, int inseam) {
    final newMeasurements = Measurements(
      height: height,
      chest: chest,
      waist: waist,
      inseam: inseam,
    );
    _userProfile = _userProfile.copyWith(measurements: newMeasurements);
    notifyListeners();
  }
}
