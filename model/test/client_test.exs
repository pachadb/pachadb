defmodule Model.ClientTest do
  use ExUnit.Case
  use PropCheck

  def gen() do
    let [
      entity <- binary(10),
      field <- binary(10),
      value <- binary(10)
    ] do
      Model.Fact.create(Model.TxId.next(), entity, field, value)
    end
  end

  # property "when a client is disconnected stating facts remain unsynced" do
  #   forall facts <- list(Model.Fact.gen()) do
  #     client = Model.Client.new_disconnected_client()
  #     client = Model.Client.state_facts(client, facts)
  #     client.unsynced_facts == facts
  #   end
  # end

  # property "client rebases local changes on top of server changes" do
  #   forall [
  #     server_facts <- non_empty(list(Model.Fact.gen())),
  #     local_facts <- non_empty(list(Model.Fact.gen()))
  #   ] do
  #     server = Model.Server.new(server_facts)

  #     {:ok, client, last_client_tx_id, last_tx_id} =
  #       Model.Client.new()
  #       |> Model.Client.connect()
  #       |> Model.Client.state_facts(local_facts)
  #       |> Model.Client.sync(server)

  #     assert client.unsynced_facts == []

  #     client.synced_facts == Model.Fact.rebase(server_facts, local_facts)
  #   end
  # end

  property "rebasing puts transaction on top of other correctly", [:verbose] do
    forall [server_facts <- gen(), client_facts <- gen()] do
      implies length(server_facts) > 0 do
        implies length(client_facts) > 0 do
          IO.puts(server_facts)
          rebased = Model.Fact.rebase(server_facts, client_facts)

          assert Enum.max_by(server_facts, &Model.Fact.tx_id/1)
                 |> Model.Fact.tx_id() <
                   Enum.min_by(rebased, &Model.Fact.tx_id/1) |> Model.Fact.tx_id(),
                 "all server facts have tx_ids lower than rebased facts"
        end
      end

      # assert "all server facts have tx_ids lower than rebased facts",
      #        server_facts |> Enum.map(&Model.Fact.tx_id/1) |> Enum.max() <
      #          rebased_facts |> Enum.map(&Model.Fact.tx_id/1) |> Enum.min()
    end
  end
end
