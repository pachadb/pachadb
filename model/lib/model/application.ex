defmodule Model.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Model.TxId, 0}
      # Starts a worker by calling: Model.Worker.start_link(arg)
      # {Model.Worker, arg}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Model.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
