# revenuecat-migrate-placements-to-checkpoints: Android (native)

Needs RevenueCat SDK **11.1.0+** with `purchases-ui` (`revenuecatui`).

## Opt-in and imports

The checkpoint API needs an opt-in. Add this on the class, function or file that uses it:

```kotlin
@OptIn(InviteOnlyCheckpointsAPI::class)
```

```kotlin
import com.revenuecat.purchases.ui.revenuecatui.checkpoints.checkpoint
```

If `checkpoint` is not found, the SDK is too old or the project is not in the beta. Ask the user.

## The call

```kotlin
Purchases.sharedInstance.checkpoint("my_checkpoint") { result ->
    // runs when the customer moves past the checkpoint
}
```

With options (all optional):

```kotlin
Purchases.sharedInstance.checkpoint(
    "my_checkpoint",
    CheckpointParams {
        customVariables { "goal" to "lose_weight" }
        presentationMode(FlowPresentationMode.MODAL_SHEET)   // DEFAULT, MODAL_FULL_SCREEN, MODAL_SHEET
        paywallPresenter { params, completion -> /* ... */ }
        errorPresenter { params, completion -> /* ... */ }
    }
) { result -> /* ... */ }
```

`result.flow` is `null` when nothing was shown. Useful helpers on `result`:
- `result.hasEntitlement("pro")`: the customer has it now (got it here, or already had it).
- `result.didObtainEntitlement("pro")`: the customer got it at this checkpoint.

## Conversions

### Placement offering shown in a paywall

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
Purchases.sharedInstance.checkpoint("onboarding_end") { _ ->
    goHome()
}
```

Delete the paywall launcher, the result launcher and the offering code if they only served this paywall.

### `launchIfNeeded` with a required entitlement

Replace it with `checkpoint(id)`. Name the checkpoint using the skill's naming rule. The rule's audience must include "Has active entitlement is false".

If it guarded an action (a button that unlocks or exports), the callback also runs for customers who already have the entitlement, so check it there:

```kotlin
Purchases.sharedInstance.checkpoint("export") { result ->
    if (result.hasEntitlement("pro")) doExport()
}
```

### Do something after a purchase

```kotlin
Purchases.sharedInstance.checkpoint("feature_gate") { result ->
    if (result.didObtainEntitlement("pro")) unlockFeature()
}
```

### Your own paywall UI

Keep your UI. Show it from a paywall presenter. The SDK gives the presenter the Offering the rule chose as `params.offering`. The presenter must call `completion.complete(...)` **exactly once**. If it never does, the checkpoint never finishes.

```kotlin
import com.revenuecat.purchases.ui.revenuecatui.checkpoints.CheckpointParams
import com.revenuecat.purchases.ui.revenuecatui.checkpoints.PaywallPresenter
import com.revenuecat.purchases.ui.revenuecatui.checkpoints.paywallPresenter

Purchases.sharedInstance.checkpoint(
    "settings_upgrade",
    CheckpointParams {
        paywallPresenter { params, completion ->
            // Show your UI for params.offering. Keep `completion` until the user leaves it.
            showCustomPaywall(params.offering) { purchased ->
                completion.complete(
                    if (purchased) PaywallPresenter.Completion.Result.Continued
                    else PaywallPresenter.Completion.Result.Closed
                )
            }
        }
    }
) { _ ->
    // runs after the paywall closes or continues
}
```

Results:
- `Continued` or `Closed`: the SDK refreshes the customer's info, then the callback runs. Use `Continued` after a purchase and `Closed` when the user dismisses.
- `NavigatedBack`: the callback does **not** run.
- `params` also has `checkpointIdentifier`, `customVariables` and `presentationMode`. Follow `presentationMode` in your UI.

To use one presenter for every checkpoint, set `Purchases.sharedInstance.paywallPresenter = PaywallPresenter { params, completion -> ... }`. A presenter passed on the call wins over it.

Remove the old `getOfferings` / `getCurrentOfferingForPlacement` call.

### Reading offering data (price label, package list)

If the rule serves an **Offering** (an "offering step") instead of a Flow, the SDK gives that Offering to the presenter as `params.offering`. It is the same `Offering` type `getOfferings` returns, with packages and prices. `CheckpointResult` does not contain it. A presenter does not have to show anything: read the data, then call `complete`.

```kotlin
Purchases.sharedInstance.checkpoint(
    "pricing_label",
    CheckpointParams {
        paywallPresenter { params, completion ->
            price = params.offering.availablePackages.firstOrNull()?.product?.price?.formatted ?: "n/a"
            completion.complete(PaywallPresenter.Completion.Result.Closed)
        }
    }
) { _ -> }
```

- Always pass a presenter for this. With no presenter, the SDK shows the offering's own paywall.
- Each call counts as a checkpoint hit.
- If the screen can show another checkpoint while this one runs, the second one can be dropped. Flag it in the report (see SKILL.md step 5).
- Remove the old offering call.

### Custom error screen (optional)

Only add this if the old code had its own error handling. Without it the SDK shows its own error dialog.

```kotlin
CheckpointParams {
    errorPresenter { params, completion ->
        showMyErrorDialog { completion.complete() }
    }
}
```

Call `completion.complete()` exactly once. Failure kinds: `FLOW_COULD_NOT_BE_SHOWN`, `FLOW_ACTION_FAILED`, `FLOW_RESULT_SYNC_FAILED`. A global version exists: `Purchases.sharedInstance.errorPresenter = ErrorPresenter { params, completion -> ... }`.

### Custom variables (optional)

If the old call sent context to the paywall: `CheckpointParams { customVariables { "goal" to "lose_weight" } }`. Rules cannot use custom variables yet.
