# revenuecat-migrate-placements-to-checkpoints: Android (native)

Requires RevenueCat SDK **11.1.0+** with `purchases-ui` (`revenuecatui`). The API needs a beta opt-in. Add it on the enclosing class, function or file:

```kotlin
@OptIn(InviteOnlyCheckpointsAPI::class)
```

Import:

```kotlin
import com.revenuecat.purchases.ui.revenuecatui.checkpoints.checkpoint
```

## Signatures

```kotlin
fun Purchases.checkpoint(checkpointIdentifier: String, callback: CheckpointPassedCallback)
fun Purchases.checkpoint(checkpointIdentifier: String, params: CheckpointParams?, callback: CheckpointPassedCallback)
var Purchases.paywallPresenter: PaywallPresenter?
var Purchases.errorPresenter: ErrorPresenter?
```

`CheckpointParams { customVariables { … }; presentationMode(…); paywallPresenter { … }; errorPresenter { … } }`. Modes: `DEFAULT`, `MODAL_FULL_SCREEN`, `MODAL_SHEET`.

## Conversions

### Placement offering passed to a paywall

Before:

```kotlin
Purchases.sharedInstance.getOfferingsWith({ goHome() }) { offerings ->
    offerings.getCurrentOfferingForPlacement("onboarding_end")?.let { offering ->
        launcher.launch(PaywallActivityLaunchOptions.Builder().setOffering(offering).build())
    } ?: goHome()
}
```

After:

```kotlin
Purchases.sharedInstance.checkpoint("onboarding_end") { result ->
    goHome()
}
```

Remove the `PaywallActivityLauncher` / result launcher, `ActivityResultLauncher` wiring and the offering plumbing if they served only this paywall. Move post-paywall code into the callback.

### Entitlement-gated presentation

Where the code used `PaywallActivityLauncher.launchIfNeeded(requiredEntitlementIdentifier = …)`, use `checkpoint(id)` and put the entitlement condition on the rule's audience (**Has active entitlement is false**).

### Reacting to what was purchased

```kotlin
Purchases.sharedInstance.checkpoint("feature_gate") { result ->
    val gotPro = result.flow?.obtainedEntitlements
        ?.any { it.entitlementInfo.identifier == "pro" } == true
    if (gotPro) unlockFeature()
}
```

### Gating content on an entitlement

```kotlin
Purchases.sharedInstance.checkpoint("access_locked_content") { _ ->
    Purchases.sharedInstance.getCustomerInfoWith { customerInfo ->
        if (customerInfo.entitlements.active.containsKey("pro")) openContent()
    }
}
```

### Custom paywall UI

Set `Purchases.sharedInstance.paywallPresenter = PaywallPresenter { params, completion -> … }` globally, or pass `CheckpointParams { paywallPresenter { … } }` per call. Call `completion` exactly once with continued, closed, or navigated back (navigated back does not run the callback). Check the current presenter shape in the implementation docs before writing it.

### Optional

`Purchases.sharedInstance.errorPresenter = ErrorPresenter { params, completion -> … }` or `CheckpointParams { errorPresenter { … } }`. Failure kinds: `FLOW_COULD_NOT_BE_SHOWN`, `FLOW_ACTION_FAILED`, `FLOW_RESULT_SYNC_FAILED`.

### Custom variables

Pass as the second argument: `CheckpointParams { customVariables { "goal" to "lose_weight" } }`.
