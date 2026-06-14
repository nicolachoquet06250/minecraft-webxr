export async function activate(ctx) {
  ctx.ui.notify("Example Client Mod chargé")

  const box = ctx.BABYLON.MeshBuilder.CreateBox(
    "example-client-mod-box",
    { size: 0.4 },
    ctx.scene,
  )

  box.position.copyFrom(ctx.player.position)
  box.position.y += 2

  ctx.addDisposable(box)

  const unsubscribeTick = ctx.events.on("tick", ({ deltaTime }) => {
    box.rotation.y += deltaTime
    box.position.x = ctx.player.position.x
    box.position.z = ctx.player.position.z
  })

  ctx.addDisposable({ dispose: unsubscribeTick })
}

export async function deactivate(ctx) {
  ctx.ui.notify("Example Client Mod déchargé")
}
