defmodule Model.TxId do
  use Agent

  def start_link(init_value) do
    Agent.start_link(fn -> init_value end, name: __MODULE__)
  end

  def stop do
    Agent.stop(__MODULE__)
  end

  def next do
    Agent.get_and_update(__MODULE__, fn id -> {id, id + 1} end)
  end
end

defmodule Model.Fact do
  defstruct [
    :tx_id,
    :id,
    :entity,
    :field,
    :value
  ]

  def create(tx_id, entity, field, value) do
    %__MODULE__{
      tx_id: tx_id,
      id: "#{:rand.uniform(10_000_000)}",
      entity: entity,
      field: field,
      value: value
    }
  end

  def tx_id(%__MODULE__{tx_id: x}), do: x

  def rebase([], []), do: []

  @doc """
  Rebases a list of local facts to a new transaction ID, starting from the maximum transaction ID
  in the provided server facts.

  This function takes two lists of `Model.Fact` structs:
  - `server_facts`: the facts from the server
  - `local_facts`: the facts from the local client

  It first finds the maximum transaction ID in the server facts, then iterates through the local
  facts grouped by transaction ID. For each transaction ID, it assigns the next available transaction ID
  and creates a new list of rebased facts with the updated transaction ID.

  The function returns the rebased list of local facts.
  """
  def rebase(server_facts, local_facts) do
    max_server_id = server_facts |> Enum.max_by(&tx_id/1) |> tx_id
    local_facts_by_id = Enum.group_by(local_facts, &tx_id/1)

    Enum.map_reduce(local_facts_by_id, max_server_id, fn {_tx_id, facts}, last_tx_id ->
      next_tx_id = last_tx_id + 1
      rebased = facts |> Enum.map(fn fact -> %__MODULE__{fact | tx_id: next_tx_id} end)
      {rebased, next_tx_id}
    end)
    |> elem(0)
  end
end

defmodule Model.Client do
  defstruct [
    :is_connected,
    :unsynced_facts,
    :synced_facts,
    :last_synced_tx_id
  ]

  def new_disconnected_client() do
    %__MODULE__{
      is_connected: false,
      unsynced_facts: [],
      synced_facts: [],
      last_synced_tx_id: 0
    }
  end

  def connect(%__MODULE__{} = c) do
    %__MODULE__{c | is_connected: true}
  end

  def state_facts(%__MODULE__{} = c, facts) do
    %__MODULE__{c | unsynced_facts: c.unsynced_facts ++ facts}
  end
end
