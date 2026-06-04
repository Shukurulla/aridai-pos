import 'dart:async';

import 'package:flutter/foundation.dart';

import 'api_service.dart';

/// Polls the branch's offline-status from the global backend and exposes it as
/// a [ValueNotifier] so any screen can react (banner / disable ordering).
///
/// Design: the waiter mobile never connects to the local POS backend; instead
/// the global VPS tracks each branch's local-backend heartbeat and tells the
/// mobile when the branch went offline (see obsidian `offline-rejim.md`).
///
/// A failed poll (the phone itself has no internet) leaves the last known value
/// untouched — we never flip to "offline" on a transient mobile-network blip,
/// because order submits will surface their own network error in that case.
class BranchStatusService {
  BranchStatusService._();
  static final BranchStatusService instance = BranchStatusService._();

  static const Duration _interval = Duration(seconds: 15);

  /// True while the branch is reachable/online. Defaults to true.
  final ValueNotifier<bool> online = ValueNotifier<bool>(true);

  /// True while the branch is in admin-activated possiz (emergency) mode.
  final ValueNotifier<bool> possiz = ValueNotifier<bool>(false);

  Timer? _timer;

  /// Begin polling. Safe to call repeatedly (restarts the timer).
  void start() {
    stop(reset: false);
    _poll();
    _timer = Timer.periodic(_interval, (_) => _poll());
  }

  /// Stop polling. [reset] returns the notifiers to their optimistic defaults
  /// (used on logout).
  void stop({bool reset = true}) {
    _timer?.cancel();
    _timer = null;
    if (reset) {
      online.value = true;
      possiz.value = false;
    }
  }

  /// Force an immediate refresh (e.g. right after the admin toggles possiz).
  Future<void> refresh() => _poll();

  /// Apply a known possiz state instantly (optimistic, after a local toggle).
  void setPossizLocal(bool value) => possiz.value = value;

  Future<void> _poll() async {
    final status = await ApiService.instance.getBranchStatus();
    if (status == null) return; // network/unknown — keep last known state
    if (online.value != status.online) online.value = status.online;
    if (possiz.value != status.possiz) possiz.value = status.possiz;
  }
}
